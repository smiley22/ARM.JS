module ARM.Simulator.Devices {
    /**
     * Simulates a UART modeled after the TI TL16C750C.
     */
    export class TL16C750 extends Device {
        /**
         * Backing-fields for various properties.
         */
        private _ier: number;
        private _fcr: number;
        private _lcr: number;
        private _lsr: number;
        private _dll: number;
        private _dlm: number;

        /**
         * A reference to the set of services provided by the virtual machine.
         */
        private service: IVmService;

        /**
         * The memory-region housing the UART's memory-mapped hardware registers.
         */
        private region: Region;

        /**
         * The delegate that is invoked when the INTRPT signal goes high.
         */
        private interrupt: () => void;

        /**
         * Determines whether FIFO mode is enabled.
         */
        private fifosEnabled: boolean;

        /**
         * The UART's receiver FIFO.
         */
        private rxFifo = new Array<number>(); 

        /**
         * The UART's transmitter FIFO.
         */
        private txFifo = new Array<number>();

        /**
         * The size of the receiver and transmitter FIFOs, in bytes.
         */
        private fifoSize: number;

        /**
         * The receiver FIFO trigger level.
         */
        private triggerLevel: number;
        
        /**
         * The receiver buffer register into which deserialized character data is moved.
         */
        private get rbr() {
            return 123;
        }

        /**
         * The transmitter holding register into which data can be output.
         */
        private set thr(v: number) {
        }

        /**
         * Sets the interrupt enable register to the specified value.
         *
         * @param {number} v
         *  The value to set the interrupt enable register to.
         */
        private set ier(v: number) {
            this._ier = v;
            // TODO: Re-compute timeouts.
        }

        /**
         * Gets the interrupt enable register.
         *
         * @return {number}
         *  The contents of the interrupt enable register.
         */
        private get ier(): number {
            return this._ier;
        }

        /**
         * Gets the interrupt identification register.
         *
         * @return {number}
         *  The contents of the interrupt identification register.
         */
        private get iir() {
            var v = 0;
            // TODO: Compute on-the-fly.

            // Bits 5, 6, and 7 are to verify the FIFO operation. When all 3 bits are cleared,
            // TL16C450 mode is chosen. When bits 6 and 7 are set and bit 5 is cleared, 16-byte
            // mode is chosen. When bits 5, 6, and 7 are set, 64-byte mode is chosen.
            if (this.fifosEnabled)
                v |= 0xC0;
            if (this.fifoSize == 64)
                v |= 0x20;
            return v;
        }

        /**
         * Sets the FIFO control register to the specified value.
         *
         * @param {number} v
         *  The value to set the FIFO control register to.
         */
        private set fcr(v: number) {
            // FCR0 when set enables the transmit and receive FIFOs. This bit must be set when
            // other FCR bits are written to or they are not programmed.
            if(!(this.fifosEnabled = (v & 0x01) == 1))
                return;
            // FCR1 when set clears all bytes in the receiver FIFO and resets its counter. The
            // logic 1 that is written to this bit position is self clearing.
            if (v & 0x02)
                this.rxFifo.length = 0;
            // FCR2 when set clears all bytes in the transmit FIFO and resets its counter to 0.
            // The logic 1 that is written to this bit position is self clearing.
            if (v & 0x04)
                this.txFifo.length = 0;
            // FCR5 when set selects 64-byte mode of operation. When cleared, the 16-byte mode is
            // selected. A write to FCR bit 5 is protected by setting the line control register
            // (LCR) bit 7 = 1.
            if (this.lcr & 0x80)
                this.fifoSize = (v & 0x20) ? 64 : 16;
            else
                v = (v & ~0x20) | (this.fcr & 0x20);
            // FCR6 and FCR7 set the trigger level for the receiver FIFO interrupt.
            this.triggerLevel = (v >>> 6) & 0x03;
            // FCR1 and FCR2 are self clearing.
            this.fcr = v & ~0x06;
            // TODO: Re-compute Timeouts.
        }

        /**
         * Gets the line control register.
         *
         * @return {number}
         *  The contents of the line control register.
         */
        private get lcr() {
            return this._lcr;
        }

        /**
         * Sets the line control register to the specified value.
         *
         * @param {number} v
         *  The value to set the line control register to.
         */
        private set lcr(v: number) {
            // TODO: Re-compute Timeouts.
        }

        /**
         * The modem control register.
         *
         * @remarks
         *  The MCR's functionality is not implemented and this is just a dummy.
         */
        private mcr: number;

        /**
         * Sets the line status register to the specified value.
         *
         * @param {number} v
         *  The value to set the line status register to.
         * @remarks
         *  As per spec 'the line status register is intended for read operations only; writing
         *  to this register is not recommended outside of a factory testing environment.'.
         */
        private set lsr(v: number) {
            this._lsr = v;
        }

        /**
         * Gets the line status register.
         *
         * @return {number}
         *  The contents of the line status register.
         */
        private get lsr() {
            return 123;
        }

        /**
         * The modem status register.
         *
         * @remarks
         *  The MSR's functionality is not implemented and this is just a dummy.
         */
        private msr: number;

        /**
         * The scratch register.
         */
        private scr: number;

        /**
         * Sets the least significant byte of the devisor to the specified value.
         *
         * @param {number} v
         *  The value to set the least significant byte of the devisor to.
         * @remarks
         *  The two 8-bit registers DLL and DLM, called divisor latches, store the divisor in a
         *  16-bit binary format.
         */
        private set dll(v: number) {
            this._dll = v;
            // TODO: Re-compute Timeouts.
        }

        /**
         * Gets the least significant byte of the devisor.
         *
         * @return {number}
         *  The least significant byte of the devisor.
         */
        private get dll() {
            return this._dll;
        }

        /**
         * Sets the most significant byte of the devisor to the specified value.
         *
         * @param {number} v
         *  The value to set the most significant byte of the devisor to.
         * @remarks
         *  The two 8-bit registers DLL and DLM, called divisor latches, store the divisor in a
         *  16-bit binary format.
         */
        private set dlm(v: number) {
            this._dlm = v;
            // TODO: Re-compute Timeouts.
        }

        /**
         * Gets the most significant byte of the devisor.
         *
         * @return {number}
         *  The most significant byte of the devisor.
         */
        private get dlm() {
            return this._dlm;
        }

        /**
         * Initializes a new instance of the TL16C750C class.
         *
         * @param args
         */
        constructor(baseAddress: number, args: { interrupt: () => void }) {
            super(baseAddress);
            this.interrupt = args.interrupt;
            // Initialize registers with their respective 'MASTER RESET' values.
            this.lsr = 0x60;
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
            this.region = new Region(this.baseAddress, 0x10000,
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
         * Invoked when one of the UART's memory-maooed hardware registers is read.
         *
         * @param address
         *  The address that is read, relative to the base address of the registered region.
         * @param type
         *  The quantity that is read.
         * @return {number}
         *  The read value.
         */
        Read(address: number, type: DataType): number {
            // See TL16C750 spec, Table 3. We deviate slightly in that each register is aligned
            // to a 32-bit word boundary.
            switch (address) {
                case 0x00: return this.dlab ? this.dll : this.rbr;
                case 0x04: return this.dlab ? this.dlm : this.ier;
                case 0x08: return this.iir;
                case 0x0C: return this.lcr;
                case 0x10: return this.mcr;
                case 0x14: return this.lsr;
                case 0x18: return this.msr;
                case 0x1C: return this.scr;
            }
            return 0;
        }

        /**
         * Invoked when one of the UART's memory-mapped hardware registers is written.
         *
         * @param address
         *  The address that is written, relative to the base address of the registered region.
         * @param type
         *  The quantity that is written.
         * @param value
         *  The value that is written.
         */
        Write(address: number, type: DataType, value: number): void {
            // See TL16C750 spec, Table 3. We deviate slightly in that each register is aligned
            // to a 32-bit word boundary.
            switch (address) {
                case 0x00:
                    if (this.dlab)
                        this.dll = value;
                    else
                        this.thr = value;
                    break;
                case 0x04:
                    if (this.dlab)
                        this.dlm = value;
                    else
                        this.ier = value;
                    break;
                case 0x08:
                    this.fcr = value;
                    break;
                case 0x0C:
                    this.lcr = value;
                    break;
                case 0x10:
                    this.mcr = value;
                    break;
                case 0x14:
                    this.lsr = value;
                    break;
                case 0x18:
                    this.msr = value;
                    break;
                case 0x1C:
                    this.scr = value;
                    break;
            }
        }

        /**
         * Determines whether the devisor latch access bit is set.
         *
         * @return {boolean}
         *  true if the devisor latch access bit is set; otherwise false.
         */
        private get dlab(): boolean {
            // Bit 7 of LCR is the divisor latch access bit.
            return ((this.lcr >>> 7) & 0x01) == 1;
        }
    }
}