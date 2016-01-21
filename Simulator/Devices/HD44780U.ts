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
         * The timeout handle of the busy-flag reset callback.
         */
        private cbHandle: Object;

        /**
         * The display-data RAM of the LCD controller.
         */
        private ddRam = new Array<number>(80);

        /**
         * The address-counter.
         */
        private ac: number;

        /**
         * Determines whether the display shifts when a character is written.
         */
        private shiftDisplay: boolean;

        /**
         * Determines whether the address counter is incremented or decremented when a
         * character is written.
         */
        private incrementAc: boolean;

        /**
         * Determines whether the display is enabled.
         */
        private displayEnabled: boolean;

        /**
         * Determines whether the cursor indicator is shown.
         */
        private showCursor: boolean;

        /**
         * Determines whether blinking of the cursor position character is enabled.
         */
        private cursorBlink: boolean;

        /**
         * True if data is sent or received in 4-bit lengths, otherwise false.
         */
        private nibbleMode: boolean;

        /**
         * True if a second display line is configured.
         */
        private secondDisplayLine: boolean;

        /**
         * Determines whether the 5x10 dot character font is selected.
         */
        private largeFont: boolean;

        /**
         * The frequency of the crystal oscillator used as clock input, in hz.
         */
        private static crystalFrequency = 270000;

        /**
         * The character patterns contained in the A02 character ROM.
         */
        private static characterRomA00 = [
            // CG Ram
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
            // Custom characters #1
            '◀', '▶', '“', '”', '↟', '↡', '⚫', '↵', '↑', '↓', '→', '←', '‹', '›', '▲', '▼',
            // ASCII
            ' ', '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
            '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
            'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '^', '_',
            '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
            'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '~',
            // Custom characters #2
            '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.',
            '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.',
            '.', '.',
            // ISO 8859-1
            '¡', '¢', '£', '¤', '¥', '¦', '§', '¨', '©', 'ª', '«', '¬', 'shy', '®', '¯',
            '°', '±', '²', '³', '´', 'µ', '¶', '·', '¸', '¹', 'º', '»', '¼', '½', '¾', '¿',
            'À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï',
            'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', '×', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Þ', 'ß',
            'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï',
            'ð', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', '÷', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'þ', 'ÿ'
        ];

        /**
         * The character patterns contained in the A00 character ROM.
         */
        private static characterRomA02 = [
            // CG Ram
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
            // Empty
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
            // Modified ASCII
            ' ', '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
            '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
            'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '¥', ']', '^', '_',
            '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
            'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '→', '←',
            // Empty
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
            // Japanese Katakana (JIS X 0201)
            ' ', '｡', '｢', '｣', '､', '･', 'ｦ', 'ｧ', 'ｨ', 'ｩ', 'ｪ', 'ｫ', 'ｬ', 'ｭ', 'ｮ', 'ｯ',
            'ｰ', 'ｱ', 'ｲ', 'ｳ', 'ｴ', 'ｵ', 'ｶ', 'ｷ', 'ｸ', 'ｹ', 'ｺ', 'ｻ', 'ｼ', 'ｽ', 'ｾ', 'ｿ',
            'ﾀ', 'ﾁ', 'ﾂ', 'ﾃ', 'ﾄ', 'ﾅ', 'ﾆ', 'ﾇ', 'ﾈ', 'ﾉ', 'ﾊ', 'ﾋ', 'ﾌ', 'ﾍ', 'ﾎ', 'ﾏ',
            'ﾐ', 'ﾑ', 'ﾒ', 'ﾓ', 'ﾔ', 'ﾕ', 'ﾖ', 'ﾗ', 'ﾘ', 'ﾙ', 'ﾚ', 'ﾛ', 'ﾜ', 'ﾝ', 'ﾞ', 'ﾟ',
            // Custom characters
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '
        ];

        /**
         * Sets the I/O control register to the specified value.
         *
         * @param {number} v
         *  The value to set the I/O control register to. Only bits 0 to 2 are evaluated, all
         *  other bit positions are ignored.
         */
        private set ioctl(v: number) {
            // BIT0: Register Select.
            this.rs = (v & 0x01) == 0x01;
            // BIT1: Read/Write Select.
            this.rw = (v & 0x02) == 0x02;
            // BIT2: E Signal.
            var old = this.e;
            this.e = (v & 0x04) == 0x04;
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
            if (this.cbHandle)
                this.service.UnregisterCallback(this.cbHandle);
            this.cbHandle = null;
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
         * Executes the current instruction.
         */
        private Exec(): void {
            var op = this.Decode();
            var execTime = op.call(this);
            this.busy = true;
            // Register callback for resetting busy-flag.
            if (this.cbHandle)
                this.service.UnregisterCallback(this.cbHandle);
            if (execTime > 0) {
                // Execution time changes when frequency changes. Example: When f_cp or f_osc is
                // 250 kHz,
                // 37 µs * (270 / 250) = 40 µs.
                // The timing values returned by the operation methods are based on a 270 kHz
                // clock frequency.                                
                var t = execTime * (270000 / HD44780U.crystalFrequency);
                this.cbHandle = this.service.RegisterCallback(t, false, () => {
                    this.busy = false;
                });
            } else {
                this.busy = false;
            }
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

        /**
         * Clears the LCD display.
         *
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private ClearDisplay(): number {
            // Write ASCII space code into all DDRAM addresses.
            for (var i = 0; i < this.ddRam.length; i++)
                this.ddRam[i] = 0x20;
            // Set DDRAM address 0 into the address counter.
            this.ac = 0;
            // TODO: Unshift, set I/D to increment mode.
            // TODO: Raise event.
            return 1.52e-3;
        }

        /**
         * Returns the cursor to the left edge of the display.
         *
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private ReturnHome(): number {
            this.ac = 0;
            // TODO: Unshift
            // TODO: Raise event.
            return 1.52e-3;
        }

        /**
         * Sets display shift and address counter increment or decrement.
         *
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private SetEntryMode(): number {
            this.shiftDisplay = (this.db & 0x01) == 0x01;
            this.incrementAc = (this.db & 0x02) == 0x02;

            // TODO: Raise event.
            return 3.7e-5;
        }

        /**
         * Configures display options.
         *
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private SetDisplayControl(): number {
            this.cursorBlink = (this.db & 0x01) == 0x01;
            this.showCursor = (this.db & 0x02) == 0x02;
            this.displayEnabled = (this.db & 0x04) == 0x04;
            // TODO: Raise event.
            return 3.7e-5;
        }

        private ShiftCursorOrDisplay(): number {
            return 3.7e-5;
        }

        /**
         * Sets interface data length and other configuration parameters.
         *
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private SetFunction(): number {
            this.largeFont = (this.db & 0x04) == 0x04;
            this.secondDisplayLine = (this.db & 0x08) == 0x08;
            this.nibbleMode = (this.db & 0x10) == 0;
            // TODO: Raise event.
            return 3.7e-5;
        }

        private SetCGRamAddress(): number {
            return 3.7e-5;
        }

        private SetDDRamAddress(): number {
            return 3.7e-5;
        }

        private ReadBusyFlagAndAddress(): number {
            return 0;
        }

        private WriteRamData(): number {
            return 3.7e-5;
        }

        private ReadRamData(): number {
            return 3.7e-5;
        }
    }
}