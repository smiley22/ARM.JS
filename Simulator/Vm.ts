module ARM.Simulator {
    export class Vm {
        private cpu: Cpu;
        private memory: Memory;
        private devices: Array<Device> = new Array<Device>();

        constructor() {
        }

        RegisterDevice(device: Device, baseAddress: number): boolean {
            return true;
        }

        UnregisterDevice(device: Device): boolean {
            return true;
        }
    }
}