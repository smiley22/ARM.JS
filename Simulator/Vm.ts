///<reference path="Cpu.ts"/>
///<reference path="Memory.ts"/>

module ARM.Simulator {
    /**
     * Represents a virtual machine that 'ties together' the individual components of the
     * simulation.
     */
    export class Vm implements IVmService {
        private cpu: Cpu;
        private memory: Memory;
        private devices = new Array<Device>();
        private callbacks = [];
        private subscribers = {};


        constructor(clockRate: number, regions: Region[]) {
            this.memory = new Memory(regions);
            this.cpu = new Cpu(
                clockRate,
                (a, t) => this.memory.Read(a, t),
                (a, t, v) => this.memory.Write(a, t, v)
            );
        }

        /**
         * Gets the ARM.Simulator.Cpu instance of the VM.
         */
        get Cpu(): ARM.Simulator.Cpu {
            return this.cpu;
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
            return this.memory.Map(region);
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
            return this.memory.Unmap(region);
        }

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
         * @return {number}
         *  A handle identifying the registered callback or null if callback registration
         *  failed.
         */
        RegisterCallback(timeout: number, periodic: boolean, callback: () => void): number {
            var cb = {
                timeout: timeout,
                timespan: timeout - this.GetTickCount(),
                periodic: periodic,
                fn: callback,
                skip: false
            };
            return 10000 + this.callbacks.insert(cb, (a, b) => {
                if (a.timeout > b.timeout)
                    return 1;
                if (a.timeout < b.timeout)
                    return -1;
                return 0;                
            });
        }

        /**
         * Unregisters the specified callback.
         *
         * @param {number} handle
         *  The (opaque) handle of the callback returned by RegisterCallback when the
         *  callback method was registered with the virtual machine.
         * @return {boolean}
         *  True if the callback was successfully unregistered; Otherwise false.
         */
        UnregisterCallback(handle: number): boolean {
            this.callbacks[handle - 10000].skip = true;
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
            // Device has already been registered.
            if (this.devices.indexOf(device) >= 0)
                return false;
            if (!device.OnRegister(this))
                return false;
            this.devices.push(device);
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
            if (this.devices.indexOf(device) < 0)
                return false;
            device.OnUnregister();
            return this.devices.remove(device);
        }

        /**
         * Raises an event with any subscribed listeners.
         *
         * @param {string} event
         *  The name of the event to raise.
         * @param {any} args
         *  The arguments to pass along with the event.
         */
        RaiseEvent(event: string, args: any): void {
            if (!this.subscribers.hasOwnProperty(event))
                return;
            for (var s of this.subscribers[event])
                s(args);
        }

        /**
         * Gets the clock rate of the virtual machine's processor, in Hertz.
         */
        GetClockRate(): number {
            return this.cpu.ClockRate;
        }

        /**
         * Gets the number of clock-cycles performed since the system was started.
         */
        GetCycles(): number {
            return this.cpu.Cycles;
        }

        /**
         * Retrieves the number of seconds that have elapsed since the system
         * was started.
         */
        GetTickCount(): number {
            return this.cpu.Cycles / this.cpu.ClockRate;
        }

        RunFor(ms: number) {
            var d = new Date().getTime() + ms;
            while (d > new Date().getTime()) {
                this.cpu.Run(1000);
                var time = this.GetTickCount(),
                    reschedule = [],
                    i = 0;
                for (; i < this.callbacks.length; i++) {
                    var cb = this.callbacks[i];
                    if (cb.skip) {
                        continue;
                    }
                    if (cb.timeout > time)
                        break;
                    cb.fn();
 //                   if (cb.periodic)
//                        reschedule.push(cb);
                }
                this.callbacks.splice(0, i);
        //        for (var e of reschedule)
        //            this.RegisterCallback(time + e.timespan, true, e.fn);
            }
        }

        on(event: string, fn: (args: any) => void): ARM.Simulator.Vm {
            if (!this.subscribers.hasOwnProperty(event))
                this.subscribers[event] = [];
            this.subscribers[event].push(fn);
            return this;
        }
    }
}