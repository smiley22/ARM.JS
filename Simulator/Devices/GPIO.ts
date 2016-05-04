///<reference path="../Device.ts"/>

module ARM.Simulator.Devices {
    /**
     * Implements a 'pseudo' device for providing a set of general-purpose
     * input/output pins.
     */
    export class GPIO extends Device {
        /**
         * The size of the set of registers per port.
         */
        private static regSizePerPort = 0x10;

        /**
         * A reference to the set of services provided by the virtual machine.
         */
        private service: IVmService;

        /**
         * The memory-region housing the memory-mapped hardware registers.
         */
        private region: Region;

        /**
         * The number of I/O ports, where each port can address up to 32 individual pins.
         */
        private numPorts: number;

        /**
         * An array of direction registers, one for each port with each bit denoting the
         * direction of the respective pin with a cleared bit meaning input and a set bit
         * meaning output.
         */
        private dir = new Array<number>();

        /**
         * A user-provided callback that is invoked when a port is being read.
         */
        private onRead: (port: number) => number;

        /**
         * A user-provideed callback that is invoked when a word is written to a port.
         */
        private onWrite: (port: number, value: number, set: boolean, clear: boolean,
            dir: number) => void;

        /**
         * Initializes a new instance of the GPIO class.
         *
         * @param {number} baseAddress
         *  The base address in memory from which to offset any memory-mapped hardware registers.
         * @param {number} numPorts
         *  The number of I/O ports to simulate.
         * @param onRead
         *  A user-provided callback that is invoked when a port is being read.
         * @param onWrite
         *  A user-provideed callback that is invoked when a word is written to a port.
         */
        constructor(baseAddress: number, numPorts: number, onRead: (port: number) => number,
            onWrite: (port: number, value: number, set: boolean, clear: boolean,
                dir: number) => void) {
            super(baseAddress);
            this.numPorts = numPorts;
            this.onRead = onRead;
            this.onWrite = onWrite;
            // All GPIO pins are configured as input after reset.
            for (var i = 0; i < numPorts; i++)
                this.dir.push(0);
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
            var memSize = this.numPorts * GPIO.regSizePerPort;
            this.service = service;
            this.region = new Region(this.baseAddress, memSize,
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
        }

        /**
         * Invoked when one of the GPIO's memory-mapped hardware registers is read.
         *
         * @param address
         *  The address that is read, relative to the base address of the registered region.
         * @param type
         *  The quantity that is read.
         * @return {number}
         *  The read value.
         */
        Read(address: number, type: DataType): number {
            var port = ((address - this.baseAddress) / GPIO.regSizePerPort) | 0;
            var reg = address % GPIO.regSizePerPort;
            switch (reg) {
                case 0x00: // IOxPIN
                    return this.onRead(port);
                case 0x04: // IOxDIR
                    return this.dir[port] >>> 0;
                case 0x08: // IOxSET
                case 0x0C: // IOxCLR
                default:
                    return 0;
            }
        }

        /**
         * Invoked when one of the GPIO's memory-mapped hardware registers is written.
         *
         * @param address
         *  The address that is written, relative to the base address of the registered region.
         * @param type
         *  The quantity that is written.
         * @param value
         *  The value that is written.
         */
        Write(address: number, type: DataType, value: number): void {
            var port = ((address - this.baseAddress) / GPIO.regSizePerPort) | 0;
            var reg = address % GPIO.regSizePerPort;
            var dir = this.dir[port] >>> 0;
            switch (reg) {
                case 0x00: // IOxPIN
                    this.onWrite(port, value, true, true, dir);
                    break;
                case 0x04: // IOxDIR
                    this.dir[port] = value;
                    break;
                case 0x08: // IOxSET
                    this.onWrite(port, value, true, false, dir);
                    break;
                case 0x0C: // IOxCLR
                    this.onWrite(port, ~value, false, true, dir);
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