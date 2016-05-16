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
         * @param {number} timeout
         *  The timeout in simulation time after which the callback will be invoked, in
         *  seconds.
         * @param {boolean} periodic
         *  True to periodically invoke the callback until it is unregistered, or false to
         *  invoke it only once.
         * @param callback
         *  The callback method to invoke.
         * @return {Object}
         *  A handle identifying the registered callback or null if callback registration
         *  failed.
         */
        RegisterCallback(timeout: number, periodic: boolean, callback: () => void): Object;

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
         * Registers the specified device with the virtual machine.
         *
         * @param {Device} device
         *  The device to register with the virtual machine.
         * @return {boolean}
         *  true if the device was successfully registered with the virtual machine; otherwise
         *  false.
         */
        RegisterDevice(device: Device): boolean;

        /**
         * Unregisters the specified device from the virtual machine.
         *
         * @param {Device} device
         *  The device to unregister from the virtual machine.
         * @return {boolean}
         *  true if the device was successfully unregistered from the virtual machine; otherwise
         *  false.
         */
        UnregisterDevice(device: Device): boolean;

        /**
         * Raises an event with any subscribed listeners.
         *
         * @param {string} event
         *  The name of the event to raise.
         * @param {Object} sender
         *  The sender of the event.
         * @param {any} args
         *  The arguments to pass along with the event.
         */
        RaiseEvent(event: string, sender: Object, args: any): void;

        /**
         * Gets the clock-rate of the CPU, in hertz.
         */
        GetClockRate(): number;

        /**
         * Gets the number of clock-cycles performed since the system was started.
         *
         * @remarks
         *  JavaScript internally treats numbers as 64-bit floating-points with a
         *  mantissa of 52 bits, so the largest integer, such that it and all smaller
         *  integers can be stored in 64-bit floats without losing precision is 2^53.
         *  This is a reasonably large enough number for our purposes so that we can
         *  ignore overflow.
         */
        GetCycles(): number;

        /**
         * Retrieves the number of seconds that have elapsed since the system
         * was started.
         */
        GetTickCount(): number;
    }
}