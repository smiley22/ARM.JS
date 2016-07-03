///<reference path="../Device.ts"/>

module ARM.Simulator.Devices {
    /**
     * Simulates a UART modeled after the TI TL16C750C.
     */
    export class TL16C750 extends Device {
        /**
         * Backing-fields for various properties.
         */
        private _ier = 0;
        private _fcr = 0;
        private _lcr = 0;
        private _dll = 0;
        private _dlm = 0;

        /**
         * A reference to the set of services provided by the virtual machine.
         */
        private service: IVmService;

        /**
         * The memory-region housing the UART's memory-mapped hardware registers.
         */
        private region: Region;

        /**
         * The delegate that is invoked when the INTRPT output signal changes.
         */
        private interrupt: (active: boolean) => void;

        /**
         * Represents the INTRPT output signal of the UART. When true (active) an interrupt is
         * pending.
         */
        private interruptSignal = false;

        /**
         * Determines whether FIFO mode is enabled.
         */
        private fifosEnabled = false;

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
        private fifoSize = 16;

        /**
         * The receiver FIFO trigger level.
         */
        private fifoTriggerLevel = 0;

        /**
         * When set, indicates that before the character in the RBR was read, it was overwritten
         * by the next character transferred into the register.
         */
        private overrunError = false;

        /**
         * The timeout handle of the sender/receiver timeout callback.
         */
        private cbHandle: Object = null;

        /**
         * A queue of input data to simulate data arriving at the UART's serial input (SIN)
         * terminal.
         */
        private sInData = new Array<number>();

        /**
         * Determines whether the receiver buffer register has been read since the last
         * character from the receiver shift register (RSR) was put into it.
         */
        private rbrReadSinceLastTransfer: boolean;

        /**
         * Set when the THR is empty, indicating that the UART is ready to accept a new
         * character.
         */
        private thrEmpty = true;

        /**
         * Set when a complete incoming character has been received and transferred into
         * the RBR or the FIFO.
         */
        private dataReady = false;

        /**
         * The time it takes to transfer a single character including possible parity and stop
         *  bits, in seconds.
         */
        private characterTime: number;

        /**
         * The frequency of the crystal oscillator used as clock input, in hz.
         */
        private static crystalFrequency = 1843200;

        /**
         * The timeout handle of the character timeout indication callback.
         */
        private cbTimeoutHandle: Object = null;

        /**
         * Set when a character timeout indication has been raised, meaning, no characters have
         * been removed from or input to the receiver FIFO during the last four character times,
         * and there is at least one character in it during this time.
         */
        private characterTimeout = false;
        
        /**
         * The receiver buffer register into which deserialized character data is moved.
         *
         * @return {number}
         *  The contents of the receiver buffer register.
         */
        private get rbr() {
            if (this.rxFifo.length == 0)
                return 0;
            // Reset character time-out indication.
            this.ResetCharacterTimeout();
            var v = this.rxFifo.shift();
            this.rbrReadSinceLastTransfer = true;
            // The data ready bit (LSR0) is set when a character is transferred from the shift
            // register to the receiver FIFO. It is cleared when the FIFO is empty.
            this.dataReady = this.rxFifo.length > 0;
            return v;
        }

        /**
         * Determines whether the Receiver Shift Register contains yet to be deserialized data.
         *
         * @return {boolean}
         *  True if the RSR contains data; otherwise false.
         */
        private get dataInRsr(): boolean {
            return this.sInData.length > 0;
        }

        /**
         * Gets the contents of the Receiver Shift Register.
         *
         * @return {number}
         *  The contents of the Receiver Shift Register.
         */
        private get rsr(): number {
            return this.sInData.shift();
        }

        /**
         * Determines whether the Transmitter Holding Register contains data.
         *
         * @return {boolean}
         *  True if the THR contains data; otherwise false.
         */
        private get dataInThr(): boolean {
            return this.txFifo.length > 0;
        }

        /**
         * The transmitter holding register into which data can be output.
         *
         * @param {number} v
         *  The value to set the THR to.
         */
        private set thr(v: number) {
            if (!this.fifosEnabled) {
                this.txFifo[0] = v;
            } else {
                if (this.txFifo.length >= this.fifoSize)
                    this.txFifo[this.fifoSize - 1] = v;
                else
                    this.txFifo.push(v);
            }
            this.thrEmpty = false;
            if (!this.cbHandle)
                this.SetTransferCallback();
            this.SetINTRPT();
        }

        /**
         * Gets the contents of the Transmitter Holding Register.
         *
         * @return {number}
         *  The contents of the Transmitter Holding Register.
         */
        private get thr(): number {
            return this.txFifo.shift();
        }

        /**
         * Sets the interrupt enable register to the specified value.
         *
         * @param {number} v
         *  The value to set the interrupt enable register to.
         */
        private set ier(v: number) {
            this._ier = v;
            this.SetINTRPT();
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
            var v = 0x01; // None.
            // Priority 1: Overrun Error (Receiver Line Status).
            if (this.overrunError && (this.ier & 0x04)) {
                v = 0x06;
            } else if (this.fifosEnabled && (this.rxFifo.length >= this.fifoTriggerLevel) &&
                (this.ier & 0x01)) {
                // Priority 2: Trigger level reached in FIFO mode (Receiver Data Available).
                v = 0x04;
            } else if (this.fifosEnabled && this.characterTimeout && (this.ier & 0x01)) {
                // FIXME: is IER & 0x01 correct for character timeout indication?
                // Priority 2: FIFO Character Timeout indication.
                v = 0x0C;
            } else if (!this.fifosEnabled && (this.rxFifo.length > 0) && (this.ier & 0x01)) {
                // Priority 2: Receiver data available in the TL16C450 mode.
                v = 0x04;
            } else if (this.thrEmpty && (this.ier & 0x02)) {
                // Priority 3: Transmitter holding register empty.
                v = 0x02;
            }
            // Bit 4 is not used (always cleared).
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
            // Changing FCR0 clears the FIFOs.
            if ((this.fcr & 0x01) !== (v & 0x01))
                this.rxFifo.length = this.txFifo.length = 0;
            // FCR0 when set enables the transmit and receive FIFOs. This bit must be set when
            // other FCR bits are written to or they are not programmed.
            if ((this.fifosEnabled = (v & 0x01) == 1)) {
                // FCR1 when set clears all bytes in the receiver FIFO and resets its counter. The
                // logic 1 that is written to this bit position is self clearing.
                if (v & 0x02)
                    this.rxFifo.length = 0;
                // FCR2 when set clears all bytes in the transmit FIFO and resets its counter to 0.
                // The logic 1 that is written to this bit position is self clearing.
                if (v & 0x04)
                    this.txFifo.length = 0;
                // FCR5 when set selects 64-byte mode of operation. When cleared, the 16-byte
                // mode is selected. A write to FCR bit 5 is protected by setting the line control
                // register (LCR) bit 7 = 1.
                if (this.lcr & 0x80)
                    this.fifoSize = (v & 0x20) ? 64 : 16;
                else
                    v = (v & ~0x20) | (this.fcr & 0x20);
                // FCR6 and FCR7 set the trigger level for the receiver FIFO interrupt.
                var l = this.fifoSize == 64 ? [1, 16, 32, 56] : [1, 4, 8, 14];
                this.fifoTriggerLevel = l[(v >>> 6) & 0x03];
            }
            // FCR1 and FCR2 are self clearing.
            // oops, causes a stack-overflow and not needed anyway since fcr is write-only.
            //            this.fcr = v & ~0x06;
            // See if changes cause a transition of the INTRPT signal.
            this.SetINTRPT();
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
            this._lcr = v;
            if (this.cbHandle)
                this.SetTransferCallback();
        }

        /**
         * The modem control register.
         *
         * @remarks
         *  The MCR's functionality is not implemented and this is just a dummy.
         */
        private mcr = 0;

        /**
         * Gets the line status register.
         *
         * @return {number}
         *  The contents of the line status register.
         */
        private get lsr() {
            var v = this.dataReady ? 1 : 0;
            if (this.overrunError)
                v |= 0x02;
            if (this.thrEmpty) {
                v |= 0x20;
                if (this.txFifo.length == 0)
                    v |= 0x40;
            }
            // The OE indicator is cleared every time the CPU reads the contents of the LSR.
            this.overrunError = false;
            return v;
        }

        /**
         * The modem status register.
         *
         * @remarks
         *  The MSR's functionality is not implemented and this is just a dummy.
         */
        private msr = 0;

        /**
         * The scratch register.
         */
        private scr = 0;

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
            // Re-compute interval of callback if registered.
            if (this.cbHandle)
                this.SetTransferCallback();
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
            // Re-compute interval of callback if registered.
            if (this.cbHandle)
                this.SetTransferCallback();
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
         * Gets the baud-rate.
         *
         * @return {number}
         *  The baud-rate in bits per second.
         */
        private get baudrate() {
            var divisor = (this.dlm << 8) + this.dll;
            return Math.floor(TL16C750.crystalFrequency / (16 * divisor));
        }

        /**
         * Initializes a new instance of the TL16C750C class.
         *
         * @param {number} baseAddress
         *  The base address in memory from which to offset any memory-mapped hardware registers.
         * @param interrupt
         *  The delegate to invoke when a transition of the INTRPT terminal occurs. 
         */
        constructor(baseAddress: number, interrupt: (active: boolean) => void) {
            super(baseAddress);
            this.interrupt = interrupt;
        }

        /**
         * Simulates the transfer of the specified character data.
         *
         * @param {number} character
         *  The character to transfer.
         * @remarks
         *  This method is exposed as part of the Device's API and can be invoked to send
         *  data to the UART which will then arrive at its SIN terminal.
         */
        SerialInput(character: number) {
            // Alas, TypeScript/JavaScript lacks a proper byte datatype.
            if (character < 0 || character > 255)
                throw new Error('character must be in range [0, 255].');
            this.sInData.push(character);
            if (!this.cbHandle)
                this.SetTransferCallback();
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
            // FIXME: verify TypeScript '() => {}' context semantics.
            this.region = new Region(this.baseAddress, 0x100,
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
            if (this.cbHandle)
                this.ClearTransferCallback();
            this.cbHandle = null;
        }

        /**
         * Invoked when one of the UART's memory-mapped hardware registers is read.
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
                // The line status register is intended for read operations only; writing to this
                // register is not recommended outside of a factory testing environment.
                case 0x14:
                    // We'll just ignore writes to LSR.
                    // this.lsr = value;
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
         * Registers the transfer-callback with the virtual machine.
         */
        private SetTransferCallback(): void {
            var bitsPerWord = [5, 6, 7, 8];
            // Calculate the number of bits per character transmission.
            var n = 2 + bitsPerWord[this.lcr & 0x03];
            // LCR2 specifies either one, one and one-half, or two stop bits in each transmitted
            // character. When cleared, one stop bit is generated in the data. When set, the
            // number of stop bits generated is dependent on the selected word length.
            if (this.lcr & 0x04)
                n = n + (n == 7 ? .5 : 1);
            // LCR3 is the parity enable bit. When set, a parity bit is generated in transmitted
            // data between the last data word bit and the first stop bit.
            if (this.lcr & 0x08)
                n = n + 1;
            this.characterTime = n / this.baudrate;
            if (this.cbHandle)
                this.ClearTransferCallback();
            this.cbHandle = this.service.RegisterCallback(this.characterTime, true, () => {
                this.TransferCallback();
            });
        }

        /**
         * Unregisters the transfer-callback with the virtual machine.
         */
        private ClearTransferCallback(): void {
            if (this.cbHandle)
                this.service.UnregisterCallback(this.cbHandle);
            this.cbHandle = null;
        }

        /**
         * Called periodically to serialize and deserialize character data.
         */
        private TransferCallback(): void {
            // Unregister callback if nothing to do.
            if (!this.dataInRsr && !this.dataInThr)
                this.ClearTransferCallback();
            // Shift character from Receiver Shift Register into Receive Buffer Register.
            if (this.dataInRsr)
                this.TransferIntoRbr(this.rsr);
            // Shift character from Transmitter Holding Register into Transmitter Shift Register.
            if (this.dataInThr)
                this.TransferIntoTsr(this.thr);
            // Set INTRPT output signal.
            this.SetINTRPT();
        }

        /**
         * Transfers a received character from the Receiver Shift Register into the receiver
         * FIFO.
         *
         * @param rsr
         *  The contents of the Receiver Shift Register.
         */
        private TransferIntoRbr(rsr: number): void {
            if (!this.fifosEnabled) {
                this.overrunError = !this.rbrReadSinceLastTransfer;
                this.rxFifo[0] = rsr;
            } else {
                if (this.rxFifo.length < this.fifoSize) {
                    this.rxFifo.push(rsr);
                } else {
                    // Character in the shift register is overwritten, but it is not transferred
                    // to the FIFO. An OE occurs after the FIFO is full and the next
                    // character has been completely received in the shift register.
                    this.overrunError = true;
                }
            }
            // Set data-ready bit of LSR.
            this.dataReady = true;
            // Reset RBR access flag.
            this.rbrReadSinceLastTransfer = false;
            // Reset Character time-out indication.
            this.ResetCharacterTimeout();
        }

        /**
         * Transfers a character from the Transmitter Holding Register into the Transmitter
         * Shift Register.
         *
         * @param thr
         *  The contents of the Transmitter Holding Register.
         */
        private TransferIntoTsr(thr: number): void {
            this.thrEmpty = (!this.fifosEnabled) || (this.txFifo.length < this.fifoSize);
            // FIXME
            this.service.RaiseEvent('TL16C750.Data', this, thr);
        }

        /**
         * Configures the level of the INTRPT signal.
         */
        private SetINTRPT(): void {
            var oldLevel = this.interruptSignal;
            // When IIR0 is cleared, an interrupt is pending. When IIR0 is set, no interrupt is
            // pending.
            this.interruptSignal = (this.iir & 0x01) == 0;
            // Call user-defined callback if a transition from LOW to HIGH or HIGH to LOW has
            // taken place.
            if (oldLevel !== this.interruptSignal)
                this.interrupt(this.interruptSignal);
            else if (this.interruptSignal)
                this.interrupt(true);
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

        /**
         * Resets the FIFO character timeout indication.
         */
        private ResetCharacterTimeout() {
        // FIXME: this is broken.
            if (this.cbTimeoutHandle)
                this.service.UnregisterCallback(this.cbTimeoutHandle);
            this.cbTimeoutHandle = null;
            this.characterTimeout = false;
            if (!this.fifosEnabled)
                return;
            // FIFO time-out interrupt occurs when the most recent serial character was received
            // more than four continuous character times ago and the most recent microprocessor
            // read of the FIFO occurred more than four continuous character times ago.
            var timeout = 4 * this.characterTime;
            this.cbTimeoutHandle = this.service.RegisterCallback(timeout, false, () => {
                if (this.rxFifo.length > 0 && this.fifosEnabled)
                    this.characterTimeout = true;
                this.SetINTRPT();
            });
        }
    }
}