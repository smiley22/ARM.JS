module ARM.Simulator {
    export abstract class Device {

        abstract OnRegister(baseAddress:number, service: IVmService): boolean;
        abstract OnUnregister();
    }
}