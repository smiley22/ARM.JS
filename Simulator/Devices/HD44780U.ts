module ARM.Simulator.Devices {
    /**
     * Simulates an LCD modeled after the Hitachi HD44780U.
     */
    export class HD44780U extends Device {
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
            this.e = (v & 0x04) == 1;
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
            // TODO: Figure out if instruction (IR write) or write to data register (DR).
        }

        /**
         * Reads the 8-bit data bus.
         *
         * @return {number}
         *  The data read from the data bus.
         */
        private get db() {
            // TODO: Figure out if reading busy flag and address counter or reading from data
            //       register(DR).
            return 0;
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
    }
}