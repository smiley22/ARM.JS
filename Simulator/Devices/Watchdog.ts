///<reference path="../Device.ts"/>

module ARM.Simulator.Devices {
    /**
     * Simulates a watchdog timer modeled after the digital watchdog (dwd) module used in TI's
     * TMS470 family of microcontrollers.
     */
    export class Watchdog extends Device {
        /**
         * The size of the watchdog registers, in bytes.
         */
        private static regSize = 0x10;

        /**
         * The sequence of values that must be written to the key register to cause a
         * reload of the watchdog's counter register.
         */
        private static reloadSequence = [0xE51A, 0xA35C];

        /**
         * The value contained in the control register when the DWD counter is disabled.
         */
        private static counterDisabled = 0x5312ACED;

        /**
         * The default frequency of the oscillator used as clock input, in hz.
         */
        private static oscillatorFrequency = 4000000;

        /**
         * The initial value contained in the counter register after power-up.
         */
        private static initialCounterValue = 0x01FFFFFF;

        /**
         * Backing-fields.
         */
        private _control = Watchdog.counterDisabled;
        private _preload = 0x0FFF;
        private _key = 0;

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
        private cbHandle: number = null;

        /**
         * The resolution of the counter, that is, the number of ticks per second.
         */
        private counterResolution;

        /**
         * The time it takes to count down to zero from the configured preload value,
         * in seconds.
         */
        private countDownTime;

        /**
         * The last value written to the key register.
         */
        private lastKeyWrite = 0;

        /**
         * The time at which the counter register was last reloaded.
         */
        private lastReloadTime;

        /**
         * Determines whether the watchdog timer has been activated.
         */
        private get activated() {
            return this.cbHandle != null;
        }

        /**
         * Gets the control register.
         * 
         * @returns {number}
         *  The value of the control register.
         */
        private get control() {
            return this._control;
        }

        /**
         * Sets the control register to the specified value.
         * 
         * @param {number} v 
         *  The value to set the control register to.
         * @remarks
         *  Any write other than 0x5312ACED to the register enables the counter. Once the
         *  initial write has occurred, all other writes are ignored.
         */
        private set control(v: number) {
            // Once the initial write has occurred, all other writes are ignored.
            if (this.activated)
                return;
            if (v == Watchdog.counterDisabled)
                return;
            // Any write other than 0x5312ACED to the register enables the counter.
            this._control = v;
            this.activated = true;
            this.ReloadCounter();
        }

        /**
         * Gets the preload register.
         * 
         * @returns {number}
         *  The value of the preload register.
         */
        private get preload() {
            return this._preload;
        }

        /**
         * Sets the preload register to the specified value.
         * 
         * @param {number} v 
         *  The value to set the preload register to.
         * @remarks
         *  Only the 12 LSB are evaluated.
         */
        private set preload(v: number) {
            // Once the DWD has been enabled, the preload register cannot be written to by
            // the CPU.
            if (this.activated)
                return;
            // Preload is a 12-bit register.
            this._preload = v & 0xFFF;
            this.countDownTime = this.counterResolution * this._preload;
        }

        /**
         * Initializes a new instance of the Watchdog class.
         *
         * @param {number} baseAddress
         *  The base address in memory from which to offset any memory-mapped hardware registers.
         * @param {number} oscin
         *  The frequency of the input oscillator, in Hz. If this is omitted, a standard frequency
         *  of 4 Mhz will be used.
         */
        constructor(baseAddress: number, oscin?: number) {
            super(baseAddress);
            var frequency = Watchdog.oscillatorFrequency;
            if (oscin)
                frequency = oscin;
            this.counterResolution = (1 << 13) / frequency;
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
            this.region = new Region(this.baseAddress, Watchdog.regSize,
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
         * Invoked when one of the watchdog's memory-mapped hardware registers is read.
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
                    return this.control;
                case 0x04:
                    return this.preload;
                // Reading the key register yields 0.
                case 0x08:
                    return 0;
                case 0x0C:
                    return this.ReadCounter();
            }
            // ReSharper disable once NotAllPathsReturnValue
        }

        /**
         * Invoked when one of the watchdog's memory-mapped hardware registers is written.
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
                    this.control = value;
                    break;
                case 0x04:
                    this.preload = value;
                    break;
                case 0x08:
                    this.WriteKeyRegister(value);
                    break;
                // Writes to counter register are ignored.
                case 0x0C:
                    break;
            }
        }

        /**
         * Reloads the watchdog's counter register with the configured preload value.
         */
        ReloadCounter(): void {
            this.lastReloadTime = this.service.GetTickCount();
            if (this.cbHandle)
                this.service.UnregisterCallback(this.cbHandle);
            this.cbHandle = this.service.RegisterCallback(this.countDownTime, false, () => {
                this.ResetSystem();
            });
        }

        /**
         * Returns the current value of the counter register.
         */
        ReadCounter(): number {
            if (!this.activated)
                return Watchdog.initialCounterValue;
            // Interpolate current value of counter.
            var t = 1.0 - ((this.service.GetTickCount() - this.lastReloadTime) /
                this.countDownTime);
            return (this.preload * t) | 0; // Convert float to int.
        }

        /**
         * Resets the system.
         */
        ResetSystem(): void {
            this.RaiseEvent('Watchdog.Reset');
        }

        /**
         * Writes the specified value to the key register.
         * 
         * @param {number} v
         *  The value to write to the key register.
         */
        WriteKeyRegister(v: number): void {
            // A write of 0xE51A followed by 0xA35C in two separate write operations
            // defines the key sequence and reloads the DWD counter. Any value written
            // to the DWKEY other than 0xE51A or 0xA35C will cause a system reset.
            if (v != Watchdog.reloadSequence[0] && v != Watchdog.reloadSequence[1]) {
                this.ResetSystem();
            } else {
                if (this.lastKeyWrite == Watchdog.reloadSequence[0] &&
                    v == Watchdog.reloadSequence[1]) {
                    this.ReloadCounter();
                }
                this.lastKeyWrite = v;
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