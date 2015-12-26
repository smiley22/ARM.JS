module ARM.Simulator {
    export abstract class Device {

        abstract OnRegister(bla: number): boolean;
        abstract OnUnregister();
    }
}