///<reference path="../Device.ts"/>

module ARM.Simulator.Devices {
    /**
     * Simulates a Programmable Interrupt Controller modeled after the PIC used in Samsung's
     * S3C4510B microcontroller.
     */
    export class PIC extends Device {
        /**
         * The size of the PIC registers, in bytes.
         */
        private static regSize = 0x34;

        /**
         * The total number of interrupt sources of the controller.
         */
        private static numSources = 21;

        /**
         * Backing-fields with H/W default values.
         */
        private _pending = 0;
        private _mask = 0x003FFFFF;

        /**
         * A reference to the set of services provided by the virtual machine.
         */
        private service: IVmService;

        /**
         * The memory-region housing the LCD's memory-mapped hardware registers.
         */
        private region: Region;

        /**
         * The delegate that is invoked when the IRQ output signal changes.
         */
        private irq: (active: boolean) => void;

        /**
         * The delegate that is invoked when the FIQ output signal changes.
         */
        private fiq: (active: boolean) => void;

        /**
         * The mode register which determines whether an interrupt is to be serviced as a fast
         * interrupt or a normal interrupt.
         */
        private mode = 0;

        /**
         * A map of interrupt priorities to interrupt sources that defines which interrupts
         * are serviced first if multiple are pending.
         */
        private priority = new Array<number>(PIC.numSources);

        /**
         * A reversed priority map that maps interrupt sources to their respective priorities
         * for faster lookup.
         */
        private reversePriority = new Array<number>(PIC.numSources);

        /**
         * The pending register which contains pending bits for each interrupt source.
         */
        private pending = 0;

        /**
         * The interrupt pending by priority register.
         */
        private pendingByPriority = 0;

        /**
         * The FIQ output of the controller, with true denoting HIGH and false denoting LOW.
         */
        private outFIQ = false;

        /**
         * The IRQ output of the controllerm with true denoting HIGH and false denoting LOW.
         */
        private outIRQ = false;

        /**
         * Sets the contents of the mask register.
         * 
         * @param v
         *  The value to set the mask register to.
         */
        private set mask(v: number) {
            this._mask = v;
            this.UpdateState();
        }

        /**
         * Gets the contents of the mask register.
         * 
         * @returns {number}
         *  The contents of the mask register.
         */
        private get mask(): number {
            return this._mask;
        }

        /**
         * Gets the contents of the interrupt offset register, which contains the interrupt offset
         * address of the interrupt, which has the highest priority among the pending interrupts.
         *
         * @returns {number}
         *  The contents of the interrupt offset register.
         * @remarks
         *  If all interrupt pending bits are 0 when you read this register, the return value
         *  is 0x00000054.
         */
        private get offset(): number {
            if (this.pendingByPriority == 0)
                return 0x00000054;
            for (var i = PIC.numSources - 1; i >= 0; i--) {
                if ((this.pendingByPriority >>> i) & 0x01) {
                    var source = this.priority[i];
                    if (!this.IsMasked(source))
                        return source << 2;
                }
            }
            return 0x00000054;
        }

        /**
         * Gets the contents of the FIQ interrupt offset register.
         *
         * @returns {number}
         *  The contents of the FIQ interrupt offset register.
         */
        private get fiqOffset(): number {
            if (this.pendingByPriority == 0)
                return 0x00000054;
            for (var i = PIC.numSources - 1; i >= 0; i--) {
                if ((this.pendingByPriority >>> i) & 0x01) {
                    var source = this.priority[i];
                    if (!this.IsMasked(source) && this.IsFIQ(source))
                        return source << 2;
                }
            }
            return 0x00000054;
        }

        /**
         * Gets the contents of the IRQ interrupt offset register.
         *
         * @returns {number}
         *  The contents of the IRQ interrupt offset register.
         */
        private get irqOffset(): number {
            if (this.pendingByPriority == 0)
                return 0x00000054;
            for (var i = PIC.numSources - 1; i >= 0; i--) {
                if ((this.pendingByPriority >>> i) & 0x01) {
                    var source = this.priority[i];
                    if (!this.IsMasked(source) && !this.IsFIQ(source))
                        return source << 2;
                }
            }
            return 0x00000054;
        }

        /**
         * Determines whether interrupts are globally disabled.
         *
         * @returns {boolean}
         *  true if no interrupts are serviced; otherwise false.
         */
        private get interruptsDisabled(): boolean {
            return ((this.mask >>> 21) & 0x01) == 0x01;
        }

        /**
         * Writes the specified value to the interrupt pending register.
         *
         * @param v
         *  The value to set the interrupt pending register.
         */
        private WritePendingRegister(v: number) {
            // The pending bit is cleared by writing a 1 to the apropriate pending bit
            // position.
            this.pending &= ~v;
            this.pendingByPriority = 0;
            for (var i = 0; i < PIC.numSources; i++) {
                if ((this.pending >>> i) & 0x01)
                    this.pendingByPriority |= (1 << this.reversePriority[i]);
            }
            this.UpdateState();
        }

        /**
         * Writes the specified value to the interrupt pending test register.
         *
         * @param v
         *  The value to set the interrupt pending test register.
         */
        private WritePendingTestRegister(v: number) {
            // Manual: The interrupt pending test register, INTPNDTST, is used to set or clear
            //         INTPND and INTPNDPRI. If the user writes data to this register, it is
            //         written into both the INTPND register and INTPNDPRI register.
            this.pending = v;
            this.pendingByPriority = 0;
            for (var i = 0; i < PIC.numSources; i++) {
                if ((this.pending >>> i) & 0x01)
                    this.pendingByPriority |= (1 << this.reversePriority[i]);
            }
            this.UpdateState();
        }

        /**
         * Writes the specified value to the priority register with the specified index.
         *
         * @param index
         *  The index of the priority register to write, going from 0 to 5.
         * @param v
         *  The value to set the priority register to.
         */
        private WritePriorityRegister(index: number, v: number) {
            for (var i = 0; i < 4; i++) {
                this.priority[index * 4 + i] = (v >>> i * 8) & 0x1F;
                this.reversePriority[(v >>> i * 8) & 0x1F] = index * 4 + i;
            }
        }

        /**
         * Gets the priority register with the specified index.
         *
         * @param index
         *  The index of the priority register whose value to retrieve.
         * @returns {number}
         *  The contents of the priority register with the specified index.
         */
        private ReadPriorityRegister(index: number) {
            var ret = 0;
            for (var i = 3; i >= 0; i--)
                ret = (ret << 8) + this.priority[index * 4 + i];
            return ret;
        }

        /**
         * Initializes a new instance of the PIC class.
         *
         * @param {number} baseAddress
         *  The base address in memory from which to offset any memory-mapped hardware registers.
         * @param irq
         *  The delegate to invoke when a transition of the IRQ terminal occurs.
         * @param fiq
         *  The delegate to invoke when a transition of the FIQ terminal occurs.
         */
        constructor(baseAddress: number, irq: (active: boolean) => void,
            fiq: (active: boolean) => void) {
            super(baseAddress);
            this.irq = irq;
            this.fiq = fiq;
            for (var i = 0; i < PIC.numSources; i++)
                this.priority[i] = this.reversePriority[i] = i;
        }

        /**
         * The method that is called when the device is registered with a virtual machine.
         *
         * @param {IVmService} service
         *  A reference to a set of services provided by the virtual machine.
         * @return {boolean}
         *  True if device registration was successful; Otherwise false.
         */
        OnRegister(service: IVmService): boolean {
            this.service = service;
            this.region = new Region(this.baseAddress, PIC.regSize,
                (a, t) => { return this.Read(a, t); },
                (a, t, v) => { this.Write(a, t, v); });
            if (!service.Map(this.region))
                return false;
            return true;
        }

        /**
         * The method that is called when the device is removed from a virtual machine.
         *
         * @remarks
         *  A device can use this event to unmap it's H/W registers from memory, dispose
         *  of timeouts etc.
         */
        OnUnregister() {
            if (this.region)
                this.service.Unmap(this.region);
            this.region = null;
        }

        /**
         * Invoked when one of the PIC's memory-mapped hardware registers is read.
         *
         * @param address
         *  The address that is read, relative to the base address of the registered region.
         * @param type
         *  The quantity that is read.
         * @return {number}
         *  The read value.
         */
        Read(address: number, type: DataType): number {
            switch (address) {
                case 0x00:
                    return this.mode;
                case 0x04:
                    return this.pending;
                case 0x08:
                    return this.mask;
                case 0x0C:
                case 0x10:
                case 0x14:
                case 0x18:
                case 0x1C:
                case 0x20:
                    return this.ReadPriorityRegister((address - 0x0C) / 4);
                case 0x24:
                    return this.offset;
                case 0x28:
                    return this.pendingByPriority;
                case 0x30:
                    return this.fiqOffset;
                case 0x34:
                    return this.irqOffset;
            }
            return 0;
        }

        /**
         * Invoked when one of the PIC's memory-mapped hardware registers is written.
         *
         * @param address
         *  The address that is written, relative to the base address of the registered region.
         * @param type
         *  The quantity that is written.
         * @param value
         *  The value that is written.
         */
        Write(address: number, type: DataType, value: number): void {
            switch (address) {
                case 0x00:
                    this.mode = value;
                    break;
                case 0x04:
                    this.WritePendingRegister(value);
                    break;
                case 0x08:
                    this.mask = value;
                    break;
                case 0x0C:
                case 0x10:
                case 0x14:
                case 0x18:
                case 0x1C:
                case 0x20:
                    this.WritePriorityRegister((address - 0x0C) / 4, value);
                    break;
                case 0x2C:
                    this.WritePendingTestRegister(value);
                    break;
            }
        }

        /**
         * Sets the source signal on the specified pin of the PIC to the specified state.
         *
         * @param pin
         *  One of the 21 pins of the PIC denoting the respective interrupt source.
         * @param active
         *  true to set the signal HIGH, false to pull the signal LOW.
         */
        SetSignal(pin: number, active: boolean) {
            if (pin < 0 || pin > PIC.numSources)
                throw new Error('IllegalArgument');
            // When an interrupt request is generated, its pending bit is set to 1.
            if (active) {
                this.pending |= (1 << pin);
                this.pendingByPriority |= (1 << this.reversePriority[pin]);
            }
            // Configure outputs.
            this.UpdateState();
        }

        /**
         * Updates the state of the outgoing FIQ and IRQ signals of the PIC that are fed into the
         * respective CPU inputs.
         */
        private UpdateState() {
            if (this.pending == 0 || this.interruptsDisabled) {
                // Pull FIQ out low.
                if (this.outFIQ)
                    this.fiq(false);
                this.outFIQ = false;
                // Pull IRQ out low.
                if (this.outIRQ)
                    this.irq(false);
                this.outIRQ = false;
            } else {
                var pendingFIQ = false, pendingIRQ = false;
                for (var i = 0; i < PIC.numSources; i++) {
                    if (!this.IsPending(i) || this.IsMasked(i))
                        continue;
                    if (this.IsFIQ(i))
                        pendingFIQ = true;
                    else
                        pendingIRQ = true;
                }
                if ((this.outFIQ && !pendingFIQ) || (!this.outFIQ && pendingFIQ))
                    this.fiq(this.outFIQ = !this.outFIQ);
                if ((this.outIRQ && !pendingIRQ) || (!this.outIRQ && pendingIRQ))
                    this.irq(this.outIRQ = !this.outIRQ);
            }
        }

        /**
         * Determines whether the specified interrupt source is configured to be processed
         * as an FIQ interrupt.
         *
         * @param source
         *  The interrupt source.
         * @return {boolean}
         *  true if the specified source is processed as an FIQ interrupt; otherwise false.
         */
        private IsFIQ(source: number): boolean {
            return ((this.mode >>> source) & 0x01) == 0x01;
        }

        /**
         * Determines whether the specified interrupt source is masked, that is, not serviced
         * by the CPU.
         *
         * @param source
         *  The interrupt source.
         * @return {boolean}
         *  true if the specified source is masked; otherwise false.
         */
        private IsMasked(source: number): boolean {
            // BIT21 is the global mask bit; if the global mask bit is 1, no interrupts are
            // serviced.
            var global = 21;
            return ((this.mask >>> global) & 0x01) == 0x01 ||
                   ((this.mask >>> source) & 0x01) == 0x01;
        }

        /**
         * Determines whether the specified interrupt source is pending, that is, waiting to
         * be serviced.
         *
         * @param source
         *  The interrupt source.
         * @return {boolean}
         *  true if the specified source is pending; otherwise false.
         */
        private IsPending(source: number): boolean {
            return ((this.pending >>> source) & 0x01) == 0x01;
        }
    }
}