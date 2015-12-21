module ARM.Simulator {
    export class Memory {
        constructor() {
			console.log("Memory");
        }

        Map() {
        }

        Unmap() {
        }

        Read(address: number, type: DataType): number {
            return 123;
        }

        Write(address: number, type: DataType, value: number) {
        }
    }
}

