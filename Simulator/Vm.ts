module ARM.Simulator {
    /**
     * Represents a virtual machine that 'ties together' the individual components of the
     * simulation.
     */
    export class Vm implements IVmService {
        private cpu: Cpu;
        private memory: Memory;
        private devices = new Array<Device>();
        private isWebWorker: boolean;
        private cycleTime: number;
        private clockRate: number;



        constructor(clockRate:number, regions: Region[]) {
            this.memory = new Memory(regions);
            this.cpu = new Cpu(clockRate, this.memory.Read, this.memory.Write);

            this.isWebWorker = self instanceof Window;
            this.cycleTime = 1.0 / (clockRate * 100000);
            this.clockRate = clockRate * 100000;
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
            if (this.isWebWorker) {
                postMessage('bla bla', 'origin');
            } else {
//                dispatchEvent
            }
        }

        ClockRate(): number {
            return this.clockRate;
        }
    }
}