///<reference path="../Simulator/IVmService.ts"/>

module ARM.Simulator.Tests {
    /**
     * Mocks the functionality provided by the IVmService interface.
     */
    export class MockService implements IVmService {
        private raisedEvents: any[] = [];
        private clockRate: number;
        private cycles = 0;

        get RaisedEvents() {
            return this.raisedEvents;
        }

        constructor(clockRateMhz?: number) {
            this.clockRate = clockRateMhz * 1000000;
        }

        Tick(ms: number) {
            // Translate ms into number of clock cycles
            this.cycles = this.cycles + (this.clockRate * (ms / 1000.0) | 0);
        }

        /**
         * Maps the specified region into the virtual machine's 32-bit address space.
         *
         * @param {Region} region
         *  The region to map into the address space.
         * @return {boolean}
         *  True if the section was mapped into the address space; Otherwise false.
         */
        Map(region: Region): boolean {
            return true;
        }

        /**
         * Unmaps the specified region from the virtual machine's 32-bit address space.
         *
         * @param {Region} region
         *  The region to unmap.
         * @return {boolean}
         *  True if the region was unmapped; Otherwise false.
         */
        Unmap(region: Region): boolean {
            return true;
        }

        /**
         * Registers the specified callback method with the virtual machine.
         *
         * @return {Object}
         *  A handle identifying the registered callback or null if callback registration
         *  failed.
         */
        RegisterCallback(timeout: number, periodic: boolean, callback: () => void): number {
            if (!periodic)
                return self.setTimeout(callback, timeout * 1000);
            return self.setInterval(callback, timeout * 1000);
        }

        /**
         * Unregisters the specified callback.
         *
         * @param {Object} handle
         *  The (opaque) handle of the callback returned by RegisterCallback when the
         *  callback method was registered with the virtual machine.
         * @return {boolean}
         *  True if the callback was successfully unregistered; Otherwise false.
         */
        UnregisterCallback(handle: number): boolean {
            self.clearInterval(handle);
            self.clearTimeout(handle);

            return true;
        }

        /**
         * Registers the specified device with the virtual machine.
         *
         * @param {Device} device
         *  The device to register with the virtual machine.
         * @return {boolean}
         *  true if the device was successfully registered with the virtual machine; otherwise
         *  false.
         */
        RegisterDevice(device: Device): boolean {
            return true;
        }

        /**
         * Unregisters the specified device from the virtual machine.
         *
         * @param {Device} device
         *  The device to unregister from the virtual machine.
         * @return {boolean}
         *  true if the device was successfully unregistered from the virtual machine; otherwise
         *  false.
         */
        UnregisterDevice(device: Device): boolean {
            return true;
        }

        /**
         * Raises an event with any subscribed listeners.
         */
        RaiseEvent(event: string, args: any): void {
            this.raisedEvents.push([event, args]);
        }

        /**
         * Gets the clock-rate of the CPU, in hertz.
         */
        GetClockRate(): number {
            return this.clockRate;
        }

        /**
         * Gets the number of clock-cycles performed since the system was started.
         */
        GetCycles(): number {
            return this.cycles;
        }

        /**
         * Retrieves the number of seconds that have elapsed since the system
         * was started.
         */
        GetTickCount(): number {
            return this.cycles / this.clockRate;
        }
    }
}