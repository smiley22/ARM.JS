module ARM.Simulator {
    export interface IVmService {
        Map(region: Region): boolean;
        Unmap(region: Region): boolean;

        RegisterCallback(blabla: number): Object;
        UnregisterCallback(handle: Object): boolean;

        RaiseEvent(event: any): void;
    }
}