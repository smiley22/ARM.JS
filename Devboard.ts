///<reference path="Simulator/Vm.ts"/>

module ARM.Simulator {
    /**
     * Represents an ARM-based development board.
     */
    export class Devboard {
        /**
         * The clock-rate of the ARM7 CPU, in megahertz.
         */
        private static clockRate = 6.9824;

        /**
         * The starting address of the board's read-only memory (ROM).
         */
        private static romStart = 0x00000000;

        /**
         * The size of the board's ROM, in bytes.
         */
        private static romSize = 0x4000;

        /**
         * The starting address of the board's static RAM memory.
         */
        private static ramStart = 0x00040000;

        /**
         * The size of the board's RAM, in bytes.
         */
        private static ramSize = 0x8000;

        /**
         * Determines where the board's device's memory-mapped registers reside in the address
         * space.
         */
        private static memoryMap = {
            uart0:      0xE0000000,
            uart1:      0xE0004000,
            lcd:        0xE0008000,
            pic:        0xE0010000,
            timer0:     0xE0014000,
            timer1:     0xE0018000,
            gpio:       0xE001C000,
            rtc:        0xE0020000,
            watchdog:   0xE0024000,
            scb:        0xE01FC000
        };

        /**
         * Determines how the interrupt request-lines of the board's programmable interrupt
         * controller are wired up with the board's devices.
         */
        private static interruptMap = {
            uart0:      0,
            uart1:      1,
            timer0:     2,
            timer1:     3
        }

        private vm: Simulator.Vm;
        private elf: Simulator.Elf.Elf32;
        private uart0: Simulator.Devices.TL16C750;
        private uart1: Simulator.Devices.TL16C750;
        private subscribers = {};
        private buttonPushed = [false, false, false, false];
        private romData: { offset: number, data: number[] }[];
        private ramData: { offset: number, data: number[] }[];

        /**
         * Initializes a new instance of the Devboard, loading into memory the specified ELF
         * image file.
         *
         * @param elfImageOrSections
         *  An ELF image file that will be loaded into the board's ROM/RAM, or a key/value
         *  list of sections to load into ROM/RAM as is produced by the ARM.Assembler
         *  module.
         */
        constructor(elfImageOrSections: number[] | {}) {
            // Union types really are quite ugly.
            if (elfImageOrSections instanceof Array)
                this.MapElfFile(elfImageOrSections);
            else
                this.MapSections(elfImageOrSections);
            this.Initialize();
        }

        /**
         * Simulates the transfer of the specified character data.
         *
         * @param uart
         *  The UART to input the data to.
         * @param character
         *  The 8-bit character to transfer.
         */
        SerialInput(uart: number, character: number) {
            switch (uart) {
                case 0:
                    this.uart0.SerialInput(character);
                    break;
                case 1:
                    this.uart1.SerialInput(character);
                    break;
                default:
                    throw new Error(`Invalid value ${uart} for parameter 'uart'`);
            }            
        }

        /**
         * Pushes the specified push-button of the board.
         *
         * @param button
         *  The zero-based index of the button to push.
         * @exception
         *  The value provided for the button parameter is not in the range of [0, 3].
         */
        PushButton(button: number) {
            if (button < 0 || button >= this.buttonPushed.length)
                throw new Error(`Invalid value ${button} for parameter 'button'`);
            this.buttonPushed[button] = true;
        }

        /**
         * Releases the specified push-button of the board.
         *
         * @param button
         *  The zero-based index of the button to release.
         * @exception
         *  The value provided for the button parameter is not in the range of [0, 3].
         */
        ReleaseButton(button: number) {
            if (button < 0 || button >= this.buttonPushed.length)
                throw new Error(`Invalid value ${button} for parameter 'button'`);
            this.buttonPushed[button] = false;
        }

        /**
         * Resets the virtual-machine, that is, resets the CPU and all devices to the same
         * state as after power-up.
         */
        Reset() {
            this.Initialize();
        }

        /**
         * Runs the VM for the specified number of milliseconds.
         *
         * @param ms
         *  The number of milliseconds to run the VM before returning control to the caller.
         */
        RunFor(ms: number) {
            this.vm.RunFor(ms);
        }

        /**
         * Runs the VM for the specified number of processor clock-cycles.
         *
         * @param count
         *  The number of clock-cycles to execute before returning control to the caller.
         * @return {number}
         *  The difference between the number of requested clock-cycles and the actual number
         *  of clock-cycles performed. This may be 0 or a negative value.
         */
        Run(count: number) {
            this.vm.Run(count);
        }

        /**
         * Executes a single CPU instruction.
         */
        Step() {
            return this.vm.Step();
        }

        /**
         * Gets a copy of the current CPU register values.
         *
         * @return
         *  An object with a copy of the GPR and CPSR register values.
         */
        GetCpuRegs() {
            return this.vm.GetCpuRegs();
        }

        /**
         * Reads the specified quantity of data from the specified memory address.
         *
         * @param {number} address
         *  The memory address from which to read the data.
         * @param {DataType} type
         *  The quantity of data to read.
         * @return {number}
         *  The read data.
         * @exception
         *  An abort was signaled and the memory access could not be completed.
         * @remarks
         *  All data values must be aligned on their natural boundaries. All words must be
         *  word-aligned. When a word access is signaled the memory system ignores the bottom
         *  two bits, and when a halfword access is signaled the memory system ignores the
         *  bottom bit.
         */
        ReadMemory(address: number, type: DataType) {
            return this.vm.ReadMemory(address, type);
        }

        /**
         * Initializes the board's virtual-machine and devices.
         */
        private Initialize() {
            this.vm = new Simulator.Vm(Devboard.clockRate, [
                    // ROM
                    new Simulator.Region(Devboard.romStart, Devboard.romSize, null,
                        Simulator.Region.NoWrite, this.romData
                    ),
                    // static RAM
                    new Simulator.Region(Devboard.ramStart, Devboard.ramSize, null,
                        null, this.ramData
                    )
                ]
            );
            // Create and initialize board peripherals.
            this.InitDevices();
            this.InitScb();
            this.DelegateEvents();
        }

        /**
         * Initializes the board's devices.
         *
         * @error
         *  Device registration failed for one or multiple devices.
         */
        private InitDevices() {
            var mm = Devboard.memoryMap,
                im = Devboard.interruptMap;
            // Setup Programmable Interrupt Controller.
            var pic = new Simulator.Devices.PIC(mm.pic, active_irq => {
                // Invert and feed into nIRQ of CPU.
                this.vm.Cpu.nIRQ = !active_irq;
            }, active_fiq => {
                // Invert and feed into nFIQ of CPU.
                this.vm.Cpu.nFIQ = !active_fiq;
                });
            this.uart0 = new Simulator.Devices.TL16C750(mm.uart0, a =>
                pic.SetSignal(im.uart0, a));
            this.uart1 = new Simulator.Devices.TL16C750(mm.uart1, a =>
                pic.SetSignal(im.uart1, a));
            var devices = [
                pic, this.uart0, this.uart1,
                new Simulator.Devices.HD44780U(mm.lcd),
                new Simulator.Devices.Timer(mm.timer0, a => pic.SetSignal(im.timer0, a)),
                new Simulator.Devices.Timer(mm.timer1, a => pic.SetSignal(im.timer1, a)),
                new Simulator.Devices.GPIO(mm.gpio, 2, port => this.GpIoRead(port),
                    (p, v, s, c, d) => this.GpIoWrite(p, v, s, c, d)),
                // FIXME
                new Simulator.Devices.DS1307(mm.rtc, new Date()),
                new Simulator.Devices.Watchdog(mm.watchdog)
            ];
            for (var device of devices) {
                if (!this.vm.RegisterDevice(device))
                    throw new Error(`Device registration failed for ${device}`);
            }
        }

        /**
         * Initializes the board's 'System Control Block' hardware registers.
         *
         * @error
         *  The SCB registers could not be mapped into the VM's address space.
         */
        private InitScb() {
            let region = new Region(Devboard.memoryMap.scb, 0x1000,
                (a, t) => this.ScbRead(a, t),
                (a, t, v) => this.ScbWrite(a, t, v));
            if (!this.vm.Map(region))
                throw new Error(`Failed mapping SCB into memory at ${Devboard.memoryMap.scb}`);
        }

        /**
         * Loads the segments of the specified ELF file.
         *
         * @param {number[]} bytes
         *  An ELF image file as an array of bytes.
         */
        private MapElfFile(bytes: number[]) {
            let elf = new ARM.Simulator.Elf.Elf32(bytes);
            this.romData = elf.Segments
                .filter(s => s.VirtualAddress < Devboard.ramStart)
                .map(s => { return { offset: s.VirtualAddress, data: s.Bytes } })
            this.ramData = elf.Segments
                .filter(s => s.VirtualAddress >= Devboard.ramStart)
                .map(s => { return { offset: s.VirtualAddress, data: s.Bytes } })
        }

        /**
         * Loads the sections contained in the specified object.
         *
         * @param sections
         *  An object containing sections to load as is produced by the ARM.Simulator.Assembler
         *  module.
         *
         * @remarks
         *  This method is just for convenience so that we can easily load the 'raw' output
         *  produced by the assembler into the VM.
         */
        private MapSections(sections: {}) {
            let a: { address: number, data: number[] }[] = [];
            for (let name in sections)
                a.push(sections[name]);
            this.romData = a.filter(s => s.address < Devboard.ramStart)
                .map(s => { return { offset: s.address, data: s.data } });
            this.ramData = a.filter(s => s.address >= Devboard.ramStart)
                .map(s => { return { offset: s.address, data: s.data } });
        }

        /**
         * Delegates events generated by the VM so they can be subscribed to.
         */
        private DelegateEvents() {
            var events = [
                'DS1307.DataWrite', 'DS1307.Tick', 'HD44780U.ClearDisplay',
                'HD44780U.ReturnHome', 'HD44780U.EntryModeSet', 'HD44780U.DisplayControl',
                'HD44780U.DisplayShift', 'HD44780U.CursorShift', 'TL16C750.Data',
                'Watchdog.Reset'
            ];
            for (let e of events) {
                this.vm.on(e, (args, sender) => {
                    this.RaiseEvent(e, sender, args);
                });
            }
        }

        /**
         * Callback invoked when a GPIO port is being read.
         *
         * @param port
         *  The port that is being read.
         * @return {number}
         *  The value of the port that is being read.
         */
        private GpIoRead(port: number) {
            // P1.4 to P1.7 are connected to push buttons.
            if (port == 0)
                return 0;
            var retVal = 0, offset = 4;
            for (var i = 0; i < this.buttonPushed.length; i++)
                retVal |= (this.buttonPushed[i] ? 1 : 0) << (i + offset);
            return retVal;
        }

        /**
         * Callback invoked when a GPIO port is being written.
         *
         * @param port
         *  The IO port that is being written to.
         * @param value
         *  The value that is being written to the IO port.
         * @param set
         *  true to set any pin HIGH whose respective bit in the value parameter is set; false
         *  otherwise.
         * @param clear
         *  true to pull any pin LOW whose respective bit in the value parameter is cleared;
         *  false otherwise.
         * @param dir
         *  Determines the configured direction for each pin of the port, with a set bit meaning
         *  output and a cleared bit meaning input.
         */
        private GpIoWrite(port: number, value: number, set: boolean, clear: boolean,
            dir: number) {
            if (port != 0)
                return;
            // P0.0 to P0.9 are connected to LEDs.
            var ledOn = [], ledOff = [];
            for (var i = 0; i < 10; i++) {
                if (((value >>> i) & 0x01) == 0x01)
                    ledOn.push(i);
                else
                    ledOff.push(i);
            }
            if (set)
                this.RaiseEvent('LED.On', this, ledOn);
            if (clear)
                this.RaiseEvent('LED.Off', this, ledOff);
        }

        /**
         * Invoked when 'System Control Block' registers are being read.
         *
         * @param {number} address
         *  The memory address from which to read the data.
         * @param {DataType} type
         *  The quantity of data to read.
         * @return {number}
         *  The read data.
         */
        private ScbRead(address: number, type: DataType) {
            return 0;
        }

        /**
         * Invoked when 'System Control Block' registers are being written.
         *
         * @param {number} address
         *  The memory address to which the data will be written.
         * @param {DataType} type
         *  The quantity of data to write.
         * @param {number} value
         *  The contents of the data.
         */
        private ScbWrite(address: number, type: DataType, value: number) {
            switch (address) {
                case 0x00:
                    if ((value & 0x01) == 1)
                        throw 'PowerOffException';
                    break;
            }
        }

        /**
         * Raises an event with any subscribed listeners.
         *
         * @param {string} event
         *  The name of the event to raise.
         * @param {Object} sender
         *  The sender of the event.
         * @param {any} args
         *  The arguments to pass along with the event.
         */
        private RaiseEvent(event: string, sender: Object, args: any): void {
            if (!this.subscribers.hasOwnProperty(event))
                return;
            for (var s of this.subscribers[event])
                s(args, sender);
        }

        /**
         * Attaches the specified event handler to the specified event.
         *
         * @param event
         *  The event to attach the event handler to.
         * @param fn
         *  The event handler to attach.
         */
        on(event: string, fn: (args: any, sender: Object) => void) {
            if (!this.subscribers.hasOwnProperty(event))
                this.subscribers[event] = [];
            this.subscribers[event].push(fn);
            return this;
        }
    }
}