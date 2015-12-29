module ARM.Simulator {
    export class Vm implements IVmService {
        private cpu: Cpu;
        private memory: Memory;
        private devices: Array<Device> = new Array<Device>();
        private isWebWorker: boolean;

        constructor(clockRate:number, regions: Region[]) {
            this.memory = new Memory(regions);
            this.cpu = new Cpu(clockRate, this.memory.Read, this.memory.Write);

            this.isWebWorker = self instanceof Window;
        }

        RegisterDevice(device: Device, baseAddress: number): boolean {
            // Device has already been registered.
            if (this.devices.indexOf(device) >= 0)
                return false;
            if (!device.OnRegister(baseAddress, this))
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
    }
}