///<reference path="Region.ts"/>

module ARM.Simulator {
    /**
     * Represents a set of housekeeping services exposed by the VM to hardware devices.
     */
    export interface IVmService {
        /**
         * Maps the specified region into the virtual machine's 32-bit address space.
         *
         * @param {Region} region
         *  The region to map into the address space.
         * @return {boolean}
         *  True if the section was mapped into the address space; Otherwise false.
         */
        Map(region: Region): boolean;

        /**
         * Unmaps the specified region from the virtual machine's 32-bit address space.
         *
         * @param {Region} region
         *  The region to unmap.
         * @return {boolean}
         *  True if the region was unmapped; Otherwise false.
         */
        Unmap(region: Region): boolean;

        /**
         * Registers the specified callback method with the virtual machine.
         *
         * @return {Object}
         *  A handle identifying the registered callback or null if callback registration
         *  failed.
         */
        RegisterCallback(timeout: number, periodic: boolean, callback:() => void): Object;

        /**
         * Unregisters the specified callback.
         *
         * @param {Object} handle
         *  The (opaque) handle of the callback returned by RegisterCallback when the
         *  callback method was registered with the virtual machine.
         * @return {boolean}
         *  True if the callback was successfully unregistered; Otherwise false.
         */
        UnregisterCallback(handle: Object): boolean;

        /**
         * Raises an event with any subscribed listeners.
         */
        RaiseEvent(event: string, args: any): void;

        /**
         * Gets the clock-rate of the CPU, in hertz.
         */
        ClockRate(): number;
    }
}