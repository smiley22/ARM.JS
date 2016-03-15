///<reference path="../Simulator/IVmService.ts"/>

module ARM.Simulator.Tests {
    /**
     * Mocks the functionality provided by the IVmService interface.
     */
    export class MockService implements IVmService {
        private raisedEvents: any[] = [];

        get RaisedEvents() {
            return this.raisedEvents;
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

            return self.setTimeout(callback, timeout * 1000);
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
            self.clearTimeout(handle);

            return true;
        }

        /**
         * Raises an event with any subscribed listeners.
         */
        RaiseEvent(event: string, args: any): void {
            this.raisedEvents.push([event, args]);
        }

        /**
         * Returns the current simulation time.
         *
         * @return {number}
         *  The current simulation time, in µs.
         */
        GetTime(): number {
            return 12345;
        }

    }
}
