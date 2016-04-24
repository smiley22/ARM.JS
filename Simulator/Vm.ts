module ARM.Simulator {
    /**
     * Represents a virtual machine that 'ties together' the individual components of the
     * simulation.
     */
    export class Vm implements IVmService {
        private cpu: Cpu;
        private memory: Memory;
        private devices = new Array<Device>();



        constructor(clockRate:number, regions: Region[]) {
            this.memory = new Memory(regions);
            this.cpu = new Cpu(clockRate, this.memory.Read, this.memory.Write);
        }


        RegisterDevice(device: Device, baseAddress: number): boolean {
            // Device has already been registered.
            if (this.devices.indexOf(device) >= 0)
                return false;
            if (!device.OnRegister(this))
                return false;
            this.devices.push(device);
            return true;
        }

        UnregisterDevice(device: Device): boolean {
            if (this.devices.indexOf(device) < 0)
                return false;
            device.OnUnregister();
            return this.devices.remove(device);
        }

        Map(region: Region): boolean {
            return this.memory.Map(region);
        }

        Unmap(region: Region): boolean {
            return this.memory.Unmap(region);
        }

        RegisterCallback(blabla: number): Object {
            return "my handle";
        }

        UnregisterCallback(handle: Object): boolean {
            return true;
        }

        RaiseEvent(event: any): void {
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
                this.cpu.Run(10000);
            }
        }
    }
}