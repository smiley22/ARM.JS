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
         * The timeout handle of the timer callback.
         */
        private cbHandle: Object = null;

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
            this._mode = v;
            // BIT0-2 contain the clock selection.
            var clkDivide = Timer.clockDivide[v & 0x03];

            // Check for enable bit.
        }

        /**
         * The 16-bit counter register, whose value is incremented according to the
         * conditions of the clock signal specified in the MODE register.
         */
        private count = 0;

        /**
         * The 16-bit compare register, whose value acts as the reference value to be
         * compared with the value of the COUNT register.
         */
        private comp = 0;

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
            return 0;
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
                case 0x04:
                    // COUNT and COMP are 16-bit registers.
                    this.count = value & 0xFFFF;
                    break;
                case 0x08:
                    this.comp = value & 0xFFFF;
                    break;
            }
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
            this.service.RaiseEvent(event, args);
        }        
    }
}