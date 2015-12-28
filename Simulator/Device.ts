module ARM.Simulator {
    export abstract class Device {

        abstract OnRegister(service: IVmService): boolean;
        abstract OnUnregister();
    }
}