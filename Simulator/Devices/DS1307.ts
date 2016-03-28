///<reference path="../Device.ts"/>

module ARM.Simulator.Devices {
    /**
     * Simulates a Real-Time Clock modeled after the DS1307.
     */
    export class DS1307 extends Device {
        /**
         * The size of the RTC and RAM registers, in bytes.
         */
        private static memSize = 0x40;

        /**
         * The contiguous block of memory containing the RTC and RAM registers.
         */
        private memory = new Array<number>(DS1307.memSize);

        /**
         * A reference to the set of services provided by the virtual machine.
         */
        private service: IVmService;

        /**
         * The memory-region housing the LCD's memory-mapped hardware registers.
         */
        private region: Region;

        /**
         * The timeout handle of timer callback.
         */
        private cbHandle: Object = null;

        /**
         * Determines whether the oscillator is enabled, meaning the clock is counting.
         * 
         * @returns {boolean} 
         *  true if the oscillator is enabled; otherwise false.
         */
        private get oscillatorEnabled(): boolean {
            // Bit 7 of register 0 is the clock halt (CH) bit. When this bit is set to a 1,
            // the oscillator is disabled. When cleared to a 0, the oscillator is enabled.
            return (this.memory[0] & 0x80) == 0;
        }

        /**
         * Determines whether the clock is operating in 12-hour mode.
         * 
         * @returns {boolean}
         *  true if the clock is operating in 12-hour mode; otherwise false.
         */
        private get twelveHourMode(): boolean {
            // The DS1307 can be run in either 12-hour or 24-hour mode. Bit 6 of the hours
            // register is defined as the 12- or 24-hour mode select bit. When high, the 12-hour
            // mode is selected.
            return (this.memory[2] & 0x40) == 0x40;
        }

        /**
         * Determines whether the PM bit of the clock is set.
         * 
         * @returns {boolean}
         *  true if the PM bit of the clock is set; otherwise false.
         * @remarks
         *  The PM bit is only relevant when operating in 12-hour mode.
         */
        private get postMeridiem(): boolean {
            // In the 12-hour mode, bit 5 of the hours register is the AM/PM bit with logic
            // high being PM.
            return (this.memory[2] & 0x20) == 0x20;
        }

        /**
         * Initializes a new instance of the DS1307 class.
         *
         * @param {number} baseAddress
         *  The base address in memory from which to offset any memory-mapped hardware registers.
         * @param {Date|number[]} time
         *  The time to initialize the RTC with, or the contents to initialize the RTC's
         *  non-volatile memory with.
         */
        constructor(baseAddress: number, timeOrMemory: Date | Array<number>) {
            super(baseAddress);
            // TypeScript lameness: no ctor overloading.
            if (Array.isArray(timeOrMemory))
                this.memory = timeOrMemory;
            else
                this.InitializeRTC(timeOrMemory);
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
            this.region = new Region(this.baseAddress, DS1307.memSize,
                (a, t) => { return this.Read(a, t); },
                (a, t, v) => { this.Write(a, t, v); });
            if (!service.Map(this.region))
                return false;
            this.SetTimer(this.oscillatorEnabled);
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
            this.SetTimer(false);
            if (this.region)
                this.service.Unmap(this.region);
            this.region = null;
        }

        /**
         * Invoked when one of the RTC's memory-mapped hardware registers is read.
         *
         * @param address
         *  The address that is read, relative to the base address of the registered region.
         * @param type
         *  The quantity that is read.
         * @return {number}
         *  The read value.
         */
        Read(address: number, type: DataType): number {
            var numBytes = type == DataType.Word ? 4 : (type == DataType.Halfword ? 2 : 1);
            var ret = 0;
            for (var i = 0; i < numBytes; i++) {
                // During a multi-byte access, when the address pointer reaches 3Fh, the end of
                // RAM space, it wraps around to location 00h, the beginning of the clock space.
                var offset = (address + i) % DS1307.memSize,
                    value = this.memory[offset];
                // Little Endian
                var shift = (numBytes - 1 - i) * 8;
                ret = ret + ((value << shift) & 0xFF);
            }
            return ret;
        }

        /**
         * Invoked when one of the RTC's memory-mapped hardware registers is written.
         *
         * @param address
         *  The address that is written, relative to the base address of the registered region.
         * @param type
         *  The quantity that is written.
         * @param value
         *  The value that is written.
         */
        Write(address: number, type: DataType, value: number): void {
            var numBytes = type == DataType.Word ? 4 : (type == DataType.Halfword ? 2 : 1);
            for (var i = 0; i < numBytes; i++) {
                var byte = (value >>> (i * 8)) & 0xFF;
                // During a multi-byte access, when the address pointer reaches 3Fh, the end of
                // RAM space, it wraps around to location 00h, the beginning of the clock space.
                var offset = (address + i) % DS1307.memSize;
                this.memory[offset] = byte;
                // Writing Bit 7 of the Seconds register enables or disables the oscillator.
                if (offset == 0)
                    this.SetTimer((byte >>> 7) == 0);
            }
            this.RaiseEvent('DS1307.DataWrite');
        }

        /**
         * Initialize the RTC with the specified date/time.
         * 
         * @param time
         *  The time to initialize the RTC with.
         */
        private InitializeRTC(time: Date): void {
            // Convert Date to BCD representation and write into RTC registers.
            this.SetTime(time);
            // Initialize RAM region
            for (var i = 8; i < DS1307.memSize; i++)
                this.memory[i] = 0x00;
            // Enable oscillator by clearing Bit 7 of Seconds register.
            this.memory[0] &= ~(1 << 7);
        }

        /**
         * Sets the clock registers of the RTC to the specified time.
         * 
         * @param time
         *  The time to set the clock registers to.
         */
        private SetTime(time: Date): void {
            var oscFlag = this.memory[0] & 0x80;
            // The DS1307 can be run in either 12-hour or 24-hour mode. Bit 6 of the
            // hours register is defined as the 12- or 24-hour mode select bit. When high,
            // the 12-hour mode is selected. In the 12-hour mode, bit 5 is the AM/PM bit
            // with logic high being PM. In the 24-hour mode, bit 5 is the second 10 hour
            // bit (20-23 hours).
            var b = this.memory[2] & 0x40;
            var h = time.getHours();
            var hours = b | DS1307.ToBCD(h);
            if (b) {
                var pm = (h > 11 ? 1 : 0) << 5;
                if (pm)
                    h = h - 12;
                hours = b | pm | DS1307.ToBCD(h);
            }
            var values = [
                // 00h: Seconds (00 - 59)
                oscFlag | DS1307.ToBCD(time.getSeconds()),
                // 01h: Minutes (00 - 59)
                DS1307.ToBCD(time.getMinutes()),
                // 02h: Hours (See comment above)
                hours,
                // 03h: Day of Week (1 - 7) 
                time.getDay() + 1,
                // 04h: Date (01 - 31)
                DS1307.ToBCD(time.getDate()),
                // 05h: Month (01 - 12)
                DS1307.ToBCD(time.getMonth() + 1),
                // 06h: Year (00 - 99)
                DS1307.ToBCD(time.getFullYear() % 100)
            ];
            for (let i = 0; i < values.length; i++)
                this.memory[i] = values[i];
        }

        /**
         * Gets the current time of the RTC.
         * 
         * @returns {Date}
         *  A Date instance initialized with the current time stored in the RTC's
         *  clock registers.
         */
        private GetTime(): Date {
            // Clear CH bit in Seconds register.
            var s = DS1307.FromBCD(this.memory[0] & 0x7F);
            var mask = this.twelveHourMode ? 0x1F : 0x3F;
            var h = DS1307.FromBCD(this.memory[2] & mask);
            if (this.twelveHourMode && this.postMeridiem)
                h = h + 12;
            var m = DS1307.FromBCD(this.memory[1]),
                d = DS1307.FromBCD(this.memory[4]),
               _m = DS1307.FromBCD(this.memory[5]) - 1,
                y = DS1307.FromBCD(this.memory[6]) + 2000;
            return new Date(y, _m, d, h, m, s);
        }

        /**
         * Sets the timer callback for updating the clock once a second.
         * 
         * @param enable
         *  true to enable the timer callback, or false to disable it.
         */
        private SetTimer(enable: boolean): void {
            if (enable) {
                if (this.cbHandle != null)
                    return;
                this.cbHandle = this.service.RegisterCallback(1, true, () => {
                    this.Tick();                        
                });
            } else {
                if (this.cbHandle == null)
                    return;
                this.service.UnregisterCallback(this.cbHandle);
                this.cbHandle = null;
            }
        }

        /**
         * Callback method called once a second to advance the clock of the RTC.
         */
        private Tick(): void {
            var newTime = new Date(this.GetTime().getTime() + 1000);
            this.SetTime(newTime);
            this.RaiseEvent('DS1307.Tick');
        }

        /**
         * Raises an event with the virtual machine.
         * 
         * @param event
         *  The name of the event to raise.
         * @param opts
         *  Additional parameters that should be passed along with the event.
         */
        private RaiseEvent(event: string, opts?: Object): void {
            var args = {
                memory: this.memory
            };
            if (opts != null) {
                for (let key in opts) {
                    if (!opts.hasOwnProperty(key))
                        continue;
                    args[key] = opts[key];
                }
            }
            this.service.RaiseEvent(event, args);
        }
        
        /**
         * Converts the specified number to the equivalent binary-coded decimal.
         * 
         * @param n
         *  The number to convert, in the range from 0 to 99.
         * @return {number}
         *  The binary-coded decimal representation of the specified integer.
         */
        static ToBCD(n: number): number {
            return (((n / 10) << 4) | (n % 10)) & 0xFF;
        }

        /**
         * Converts the specified binary-coded decimal to the equivalent binary representation.
         * 
         * @param n
         *  The binary-coded decimal, in the range from 0x00 to 0x99.
         * @return {number}
         *  The binary representation of the specified binar-coded decimal.
         */
        static FromBCD(n: number): number {
            return ((n >> 4) & 0x0F) * 10 + (n & 0x0F);
        }
    }
}