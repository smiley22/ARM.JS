module ARM.Simulator {
    /**
     * Represents the base class from which all device implementations must derive.
     */
    export abstract class Device {
        /**
         * The base address of the device's memory-mapped registers.
         */
        protected baseAddress: number;

        /**
         * Initializes a new instance of the Device class.
         *
         * @param baseAddress
         *  The base address of the device's memory-mapped registers.
         */
        constructor(baseAddress: number) {
            this.baseAddress = baseAddress;
        }

        /**
         * The method that is called when the device is registered with a virtual machine.
         *
         * @param {IVmService} service
         *  A reference to a set of services provided by the virtual machine.
         * @return {boolean}
         *  True if device registration was successful; Otherwise false.
         */
        abstract OnRegister(service: IVmService): boolean;

        /**
         * The method that is called when the device is removed from a virtual machine.
         *
         * @remarks
         *  A device can use this event to unmap it's H/W registers from memory, dispose
         *  of timeouts etc.
         */
        abstract OnUnregister();
    }
}