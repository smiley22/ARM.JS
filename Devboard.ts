///<reference path="Simulator/Vm.ts"/>

module ARM.Simulator {
    export class Devboard {
        private static clockRate = 6.9824;
        private static romStart = 0x00000000;
        private static romSize = 0x4000;
        private static ramStart = 0x00040000
        private static ramSize = 0x8000;
        private static memoryMap = {
            pic: 0xE0001000,
            uart0: 0xE0000000,
            uart1: 1234,
            lcd: 4567,
            timer0: 1235,
            timer1: 5832,
            gpio: 9871,
            rtc: 3723,
            watchdog: 19438
        };

        private static interruptMap = {
            uart0:    0,
            uart1:    1,
            timer0:   2,
            timer1:   3
        }
        private vm: ARM.Simulator.Vm;
        private elf: ARM.Simulator.Elf.Elf32;
        private uart0: ARM.Simulator.Devices.TL16C750;
        private uart1: ARM.Simulator.Devices.TL16C750;
        

        constructor(elfImage: number[]) {
            this.elf = new ARM.Simulator.Elf.Elf32(elfImage);
        }

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

        private Initialize() {
            this.vm = new ARM.Simulator.Vm(Devboard.clockRate, [
                    // ROM
                    new ARM.Simulator.Region(Devboard.romStart, Devboard.romSize, null,
                        ARM.Simulator.Region.NoWrite,
                        this.elf.Segments
                            .filter(s => s.VirtualAddress < Devboard.ramStart)
                            .map(s => { return { offset: s.VirtualAddress, data: s.Bytes } })
                    ),
                    // static RAM
                    new ARM.Simulator.Region(Devboard.ramStart, Devboard.ramSize, null,
                        null,
                        this.elf.Segments
                            .filter(s => s.VirtualAddress >= Devboard.ramStart)
                            .map(s => { return { offset: s.VirtualAddress, data: s.Bytes } })
                    )
                ]
            );
            // Create and initialize board peripherals.
            this.InitDevices();
        }

        private InitDevices() {
            var mm = Devboard.memoryMap,
                im = Devboard.interruptMap;
            // Setup Programmable Interrupt Controller.
            var pic = new ARM.Simulator.Devices.PIC(mm.pic, active_irq => {
                // Invert and feed into nIRQ of CPU.
                this.vm.Cpu.nIRQ = !active_irq;
            }, active_fiq => {
                // Invert and feed into nFIQ of CPU.
                this.vm.Cpu.nFIQ = !active_fiq;
                });
            this.uart0 = new ARM.Simulator.Devices.TL16C750(mm.uart0, a =>
                pic.SetSignal(im.uart0, a));
            this.uart1 = new ARM.Simulator.Devices.TL16C750(mm.uart1, a =>
                pic.SetSignal(im.uart1, a));
            var devices = [
                pic, this.uart0, this.uart1,
                new ARM.Simulator.Devices.HD44780U(mm.lcd),
                new ARM.Simulator.Devices.Timer(mm.timer0, a => pic.SetSignal(im.timer0, a)),
                new ARM.Simulator.Devices.Timer(mm.timer1, a => pic.SetSignal(im.timer1, a)),
                // FIXME
                new ARM.Simulator.Devices.GPIO(mm.gpio, 2, port => 0, (p, v, s, c, d) => { }),
                // FIXME
                new ARM.Simulator.Devices.DS1307(mm.rtc, new Date()),
                new ARM.Simulator.Devices.Watchdog(mm.watchdog)
            ];
            for (var device of devices) {
                if (!this.vm.RegisterDevice(device))
                    throw new Error(`Device registration failed for ${device}`);
            }
        }
    }
}