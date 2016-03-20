///<reference path="../Device.ts"/>

module ARM.Simulator.Devices {
    /**
     * Simulates an LCD modeled after the Hitachi HD44780U.
     */
    export class HD44780U extends Device {
        /**
         * 8-Bit data bus backing field.
         */
        private _db = 0;

        /**
         * Register Select. Determines whether the instruction or the data register is selected.
         */
        private rs = false;

        /**
         * Read/Write Select. Determines direction of data bus.
         */
        private rw = false;

        /**
         * Starts data read/write transfer when strobed.
         */
        private e = false;

        /**
         * Determines whether the LCD is currently busy executing an instruction.
         */
        private busy = false;

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
        private ac = 0;

        /**
         * Determines whether the display shifts when a character is written.
         */
        private shiftDisplay = false;

        /**
         * Determines whether the address counter is incremented or decremented when a
         * character is written.
         */
        private incrementAc = true;

        /**
         * Determines whether the display is enabled.
         */
        private displayEnabled = false;

        /**
         * Determines whether the cursor indicator is shown.
         */
        private showCursor = false;

        /**
         * Determines whether blinking of the cursor position character is enabled.
         */
        private cursorBlink = false;

        /**
         * True if data is sent or received in 4-bit lengths, otherwise false.
         */
        private nibbleMode = false;

        /**
         * True if a second display line is configured.
         */
        private secondDisplayLine = false;

        /**
         * Determines whether the 5x10 dot character font is selected.
         */
        private largeFont = false;

        /**
         * Determines whether reads and writes from and to RAM are satisfied from CG or DD
         * RAM, respectively.
         */
        private cgRamContext = false;

        /**
         * The character ROM of the device, containing 256 character slots (some of which
         * may be empty).
         */
        private characterRom: string[];

        /**
         * The frequency of the crystal oscillator used as clock input, in hz.
         */
        private static crystalFrequency = 270000;

        /**
         * The character patterns contained in the A02 character ROM (European standard font).
         */
        private static characterRomA02 = [
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
         * The character patterns contained in the A00 character ROM (Japanese standard font).
         */
        private static characterRomA00 = [
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
         * @param {boolean} useA00Rom
         *  If true, the A00 variant (which contains Japanese Katakana) will be used as the device's
         *  character ROM. Otherwise the A02 character ROM (European standard font) is used.
         */
        constructor(baseAddress: number, useA00Rom = false) {
            super(baseAddress);
            this.characterRom = useA00Rom ? HD44780U.characterRomA00 : HD44780U.characterRomA02;
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
            if (execTime <= 0)
                return;
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
            // ReSharper disable once NotAllPathsReturnValue
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
            this.cgRamContext = false;
            // Set I/D in entry mode to 'increment mode'.
            this.incrementAc = true;
            // TODO: Unshift.
            this.RaiseEvent('HD44780U.ClearDisplay');
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
            this.cgRamContext = false;
            // TODO: Unshift
            this.RaiseEvent('HD44780U.ReturnHome');
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
            this.RaiseEvent('HD44780U.EntryModeSet');
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
            this.RaiseEvent('HD44780U.DisplayControl');
            return 3.7e-5;
        }

        /**
         * Shifts the cursor or the display.
         * 
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private ShiftCursorOrDisplay(): number {
            var shiftDisplay = (this.db & 0x08) == 0x08;
            var shiftRight = (this.db & 0x04) == 0x04;
            if (shiftDisplay) {
                // TODO: shift display
                this.RaiseEvent('HD44780U.DisplayShift');
            }

            // TODO: introduce field cursorPos
            // if (shiftRight) cursorPos++
            // else cursorPos--;
            this.RaiseEvent('HD44780U.CursorShift');
            return 3.7e-5;
        }

        /**
         * Sets interface data length and other configuration parameters.
         *
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private SetFunction(): number {
            // Docs: Perform the function at the head of the program before executing
            //       any instructions (except for the read busy flag and address instruction).
            //       From this point, the function set instruction cannot be executed unless
            //       the interface data length is changed.
            this.largeFont = (this.db & 0x04) == 0x04;
            this.secondDisplayLine = (this.db & 0x08) == 0x08;
            this.nibbleMode = (this.db & 0x10) == 0;
            this.RaiseEvent('HD44780U.FunctionSet');
            return 3.7e-5;
        }

        /**
         * Sets the address-counter to the specified CGRAM address.
         * 
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private SetCGRamAddress(): number {
            this.ac = this.db & 0x3F;
            // Implicitly activates CGRam context for reading and writing RAM data.
            this.cgRamContext = true;
            return 3.7e-5;
        }

        /**
         * Sets the address-counter to the specified DDRAM address.
         * 
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private SetDDRamAddress(): number {
            this.ac = this.db & 0x7F;
            // Implicitly activates DDRam context for reading and writing RAM data.
            this.cgRamContext = false;
            return 3.7e-5;
        }

        /**
         * Reads out the busy-flag and value of the address-counter.
         * 
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private ReadBusyFlagAndAddress(): number {
            // Bits 0 to 6 contain the value of the address counter. Bit 7 is the busy flag.
            this.db = ((this.busy ? 1 : 0) << 7) | (this.ac & 0x7F);
            return 0;
        }

        /**
         * Writes data to CG or DD-RAM, respectively.
         * 
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private WriteRamData(): number {
            // Write into DD or GG Ram at this.ac
            if (this.cgRamContext) {

            } else {
                this.ddRam[this.ac] = this.db;
            }
            // TODO: Test edge-cases. Does AC wrap-around?
            if (this.incrementAc)
                this.ac++;
            else
                this.ac--;
            this.RaiseEvent('HD44780U.DataWrite');
            return 3.7e-5;
        }

        /**
         * Reads data from CG or DD-RAM, respectively.
         * 
         * @return {number}
         *  The time it takes to perform the operation, in seconds.
         */
        private ReadRamData(): number {
            // Write into DD or GG Ram at this.ac
            if (this.cgRamContext) {

            } else {
                this.db = this.ddRam[this.ac];
            }
            // TODO: Test edge-cases. Does AC wrap-around?
            if (this.incrementAc)
                this.ac++;
            else
                this.ac--;
            return 3.7e-5;
        }

        /**
         * Raises an event with the virtual machine.
         * 
         * @param event
         *  The name of the event to raise.
         */
        private RaiseEvent(event: string): void {
            var args = {
                ddRam: this.ddRam,
                addressCounter: this.ac,
                incrementAddressCounter: this.incrementAc,
                displayEnabled: this.displayEnabled,
                showCursor: this.showCursor,
                cursorBlink: this.cursorBlink,
                shiftDisplay: this.shiftDisplay,
                largeFont: this.largeFont,
                secondDisplayLine: this.secondDisplayLine
            };
            this.service.RaiseEvent(event, args);
        }
    }
}