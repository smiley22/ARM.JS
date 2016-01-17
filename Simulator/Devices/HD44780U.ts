module ARM.Simulator.Devices {
    /**
     * Simulates an LCD modeled after the Hitachi HD44780U.
     */
    export class HD44780U extends Device {
        /**
         * 8-Bit data bus backing field.
         */
        private _db: number;

        /**
         * Register Select. Determines whether the instruction or the data register is selected.
         */
        private rs: boolean;

        /**
         * Read/Write Select. Determines direction of data bus.
         */
        private rw: boolean;

        /**
         * Starts data read/write transfer when strobed.
         */
        private e: boolean;

        /**
         * Determines whether the LCD is currently busy executing an instruction.
         */
        private busy: boolean;

        /**
         * A reference to the set of services provided by the virtual machine.
         */
        private service: IVmService;

        /**
         * The memory-region housing the LCD's memory-mapped hardware registers.
         */
        private region: Region;

        /**
         * Sets the I/O control register to the specified value.
         *
         * @param {number} v
         *  The value to set the I/O control register to. Only bits 0 to 2 are evaluated, all
         *  other bit positions are ignored.
         */
        private set ioctl(v: number) {
            // BIT0: Register Select.
            this.rs = (v & 0x01) == 1;
            // BIT1: Read/Write Select.
            this.rw = (v & 0x02) == 1;
            // BIT2: E Signal.
            var old = this.e;
            this.e = (v & 0x04) == 1;
            // Falling Edge of E triggers operation.
            if (old && !this.e)
                this.Exec();
        }

        /**
         * Gets the I/O control register.
         *
         * @return {number}
         *  The contents of the I/O control register.
         */
        private get ioctl(): number {
            return (this.rs ? 1 : 0) + (this.rw ? 2 : 0) + (this.e ? 4 : 0);
        }

        /**
         * Writes the specified value to the 8-bit data bus (DB0 - DB7).
         *
         * @param {number} v
         *  The value to write to the data bus.
         */
        private set db(v: number) {
            this._db = v;
        }

        /**
         * Reads the 8-bit data bus.
         *
         * @return {number}
         *  The data read from the data bus.
         */
        private get db() {
            return this._db;
        }

        /**
         * Initializes a new instance of the HD44780U class.
         *
         * @param {number} baseAddress
         *  The base address in memory from which to offset any memory-mapped hardware registers.
         */
        constructor(baseAddress: number) {
            super(baseAddress);
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
        }

        /**
         * Invoked when one of the LCD's memory-mapped hardware registers is read.
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
                    return this.ioctl;
                // 8-Bit Data Bus.
                case 0x04:
                    return this.db;
            }
            return 0;
        }

        /**
         * Invoked when one of the LCD's memory-mapped hardware registers is written.
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
                    this.ioctl = value;
                    break;
                // 8-Bit Data Bus.
                case 0x04:
                    this.db = value;
                    break;
            }
        }

        /**
         * Executes an instruction.
         */
        private Exec(): void {
            var op = this.Decode();
            var execTime = op.call(this);
            this.busy = true;
            // TODO: Register VM Callback for resetting busy-flag.
        }

        /**
         * Decodes the instruction code composed of RS, RW and DB7 to DB0 and returns a
         * delegate for the method implementing the respective instruction.
         *
         * @return
         *  A delegate for the method implementing the decoded instruction.
         */
        private Decode(): (() => number) {
            if (this.rs) {
                if (this.rw)
                    return this.ReadRamData;
                else
                    return this.WriteRamData;
            } else if (this.rw) {
                return this.ReadBusyFlagAndAddress;
            } else {
                var i = 7;
                do {
                    if (this._db & (1 << i))
                        break;
                    i = i - 1;
                } while (i >= 0);
                switch (i) {
                    case 0:
                        return this.ClearDisplay;
                    case 1:
                        return this.ReturnHome;
                    case 2:
                        return this.SetEntryMode;
                    case 3:
                        return this.SetDisplayControl;
                    case 4:
                        return this.ShiftCursorOrDisplay;
                    case 5:
                        return this.SetFunction;
                    case 6:
                        return this.SetCGRamAddress;
                    case 7:
                        return this.SetDDRamAddress;
                }
            }
        }


        private ClearDisplay(): number {
            // Return execution time.
            throw new Error('Not Implemented');
        }

        private ReturnHome(): number {
            throw new Error('Not Implemented');
        }

        private SetEntryMode(): number {
            throw new Error('Not Implemented');
        }

        private SetDisplayControl(): number {
            throw new Error('Not Implemented');
        }

        private ShiftCursorOrDisplay(): number {
            throw new Error('Not Implemented');
        }

        private SetFunction(): number {
            throw new Error('Not Implemented');
        }

        private SetCGRamAddress(): number {
            throw new Error('Not Implemented');
        }

        private SetDDRamAddress(): number {
            throw new Error('Not Implemented');
        }

        private ReadBusyFlagAndAddress(): number {
            throw new Error('Not Implemented');
        }

        private WriteRamData(): number {
            throw new Error('Not Implemented');
        }

        private ReadRamData(): number {
            throw new Error('Not Implemented');
        }
    }
}