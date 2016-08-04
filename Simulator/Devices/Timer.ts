///<reference path="../Device.ts"/>

module ARM.Simulator.Devices {
    /**
     * Simulates a timer modeled after the timers used by the PS2's Emotion Engine (EE).
     */
    export class Timer extends Device {
        /**
         * Backing-fields.
         */
        private _mode = 0;
        private _comp = 0;

        /**
         * The size of the timer registers, in bytes.
         */
        private static regSize = 0x0C;

        /**
         * A reference to the set of services provided by the virtual machine.
         */
        private service: IVmService;

        /**
         * The memory-region housing the LCD's memory-mapped hardware registers.
         */
        private region: Region;

        /**
         * The delegate that is invoked when the INTRPT output signal changes.
         */
        private interrupt: (active: boolean) => void;

        /**
         * The timeout handle of the timer callback.
         */
        private cbHandle: Object = null;

        /**
         * The resolution of the timer, that is, the timespan between ticks.
         */
        private resolution: number;

        /**
         * The time it takes for the counter register to overflow at the current timer
         * resolution.
         */
        private overflowTime: number;

        /**
         * The time it takes for the counter register to count up to the compare register
         * at the current timer resolution, starting from zero.
         */
        private compEqualTime: number;

        /**
         * The reference time from which to interpolate the current value of the counter
         * register when it is being read.
         */
        private referenceTime = 0;

        /**
         * The value the counter register contained when the timer was stopped by a write
         * to the mode register.
         */
        private stopValue = 0;

        /**
         * The INT output of the timer, with true denoting HIGH and false denoting LOW.
         */
        private outINT = false;

        /**
         * Determines whether the counter is cleared to 0 when it equals the reference
         * value.
         */
        private get zeroReturn() {
            return (this._mode & 0x40) == 0x40;
        };

        /**
         * Determines whether the timer is counting.
         */
        private get countEnable() {
            return (this._mode & 0x80) == 0x80;
        };

        /**
         * If true, a compare-interrupt is generated when the counter value is equal to
         * the reference value.
         */
        private get compareInterrupt() {
            return (this._mode & 0x100) == 0x100;
        }

        /**
         * If true, an overflow-interrupt is generated when the counter register overflows.
         */
        private get overflowInterrupt() {
            return (this._mode & 0x200) == 0x200;
        }

        /**
         * Gets the value of the equal-flag of the MODE register.
         */
        private get equalFlag() {
            return (this._mode & 0x400) == 0x400;
        }

        /**
         * Gets the value of the overflow-flag of the MODE register.
         */
        private get overflowFlag() {
            return (this._mode & 0x800) == 0x800;
        }

        /**
         * Determine the frequency with which the timer increments.
         */
        private static clockDivide = [0x01, 0x10, 0x100, 0x1000];

        /**
         * Gets the contents of the mode register.
         * 
         * @returns {number}
         *  The contents of the mode register.
         */
        private get mode(): number {
            return this._mode;        
        }

        /**
         * Sets the contents of the mode register.
         * 
         * @param v
         *  The value to set the mode register to.
         */
        private set mode(v: number) {
            // BIT0-2 contain the clock selection.
            this.resolution   = Timer.clockDivide[v & 0x03] / this.service.GetClockRate();
            this.overflowTime = this.resolution * (1 << 16);
            var enable = (v & 0x80) == 0x80;
            if (!this.countEnable && enable)
                this.referenceTime = this.service.GetTickCount() -
                    this.resolution * this.stopValue;
            else if (this.countEnable && !enable)
                this.stopValue = this.ReadCount();
            // Are any interrupts pending?
            var pending = (this._mode & 0xC00) != 0;
            this._mode = v;
            // Writing 1 clears the equal and overflow flags.
            if (v & 0x400)
                this._mode &= ~0x400;
            if (v & 0x800)
                this._mode &= ~0x800;
            // If pending bits have been cleared, pull INT out LOW.
            if (this.outINT && ((this._mode & 0xC00) == 0)) {
                this.outINT = false;
                this.interrupt(false);
            }
            this.SetTimeout();
        }

        /**
         * Gets the 16-bit compare register, whose value acts as the reference value to
         * be compared with the value of the COUNT register.
         */
        private get comp() {
            return this._comp;
        }

        /**
         * Sets the contents of the 16-bit compare register.
         * 
         * @param v
         *  The value to set the compare register to.
         */
        private set comp(v: number) {
            if (v == this.comp)
                return;
            this.compEqualTime = this.resolution * v;
            this._comp = v;
            this.SetTimeout();
        }

        /**
         * Initializes a new instance of the Timer class.
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
         * The method that is called when the device is registered with a virtual machine.
         *
         * @param {IVmService} service
         *  A reference to a set of services provided by the virtual machine.
         * @return {boolean}
         *  True if device registration was successful; Otherwise false.
         */
        OnRegister(service: IVmService): boolean {
            this.service = service;
            this.region = new Region(this.baseAddress, Timer.regSize,
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
            if (this.cbHandle)
                this.service.UnregisterCallback(this.cbHandle);
            this.cbHandle = null;
            if (this.region)
                this.service.Unmap(this.region);
            this.region = null;
        }

        /**
         * Invoked when one of the timer's memory-mapped hardware registers is read.
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
                    return this.ReadCount();
                case 0x08:
                    return this.comp;
            }
            // ReSharper disable once NotAllPathsReturnValue
        }

        /**
         * Invoked when one of the timers's memory-mapped hardware registers is written.
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
                // Writes to COUNT are ignored.
                case 0x04:
                    break;
                case 0x08:
                    // COMP is a 16-bit register.
                    this.comp = value & 0xFFFF;
                    break;
            }
        }

        /**
         * Sets the next timeout for triggering an interrupt.
         */
        private SetTimeout() {
            // Clear old timeout.
            if (this.cbHandle)
                this.service.UnregisterCallback(this.cbHandle);
            this.cbHandle = null;
            // If counter is not counting or no interrupts have been enabled, nothing to do.
            if (!this.countEnable || (!this.overflowInterrupt && !this.compareInterrupt))
                return;
            // Figure out which interrupt would happen next.
            var count = this.ReadCount();
            var overflow = (1 << 16) - count,
                compare = ((this.comp - count) >>> 0) % (1 << 16);
            var next: number, isOverflow = false;
            if ((this.overflowInterrupt && !this.compareInterrupt) ||
                (this.overflowInterrupt && overflow > compare)) {
                next = overflow;
                isOverflow = true;
            } else {
                next = compare;
            }
            this.cbHandle = this.service.RegisterCallback(next * this.resolution,
                false, () => { this.GenerateInterrupt(isOverflow); });
        }

        /**
         * Generates a timer interrupt.
         * 
         * @param isOverflow
         *  true if the reason for generating an interrupt is an overflow of the counter
         *  register; false to generate a compare interrupt.
         */
        private GenerateInterrupt(isOverflow: boolean) {
            // COUNT register overflow, set overflow-flag.
            if (isOverflow) {
                this._mode |= (1 << 11);
                this.referenceTime = this.service.GetTickCount();
            } else {
                // Set equal-flag of MODE register.
                this._mode |= (1 << 10);
                if (this.zeroReturn)
                    this.referenceTime = this.service.GetTickCount();
            }
            // Set INT output HIGH, if it's not already.
            if (!this.outINT) {
                this.outINT = true;
                this.interrupt(true);
            }
        }

        /**
         * Reads the 16-bit counter register, whose value is incremented according to the
         * conditions of the clock signal specified in the MODE register.
         *
         * @return {number}
         *  The current value of the counter register.
         */
        private ReadCount() {
            if (this.countEnable == false)
                return this.stopValue;
            // Compute current value of count.
            return (((this.service.GetTickCount() - this.referenceTime) /
                this.resolution) | 0) % (1 << 16);
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
            };
            if (opts != null) {
                for (let key in opts) {
                    if (!opts.hasOwnProperty(key))
                        continue;
                    args[key] = opts[key];
                }
            }
            this.service.RaiseEvent(event, this, args);
        }
    }
}