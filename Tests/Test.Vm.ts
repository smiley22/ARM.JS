///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/TL16C750.ts"/>
///<reference path="../Simulator/Devices/HD44780U.ts"/>
///<reference path="../Simulator/Devices/PIC.ts"/>
///<reference path="../Simulator/Vm.ts"/>

/**
 * Contains integration-tests for the Virtual Machine.
 */
describe('Virtual Machine Integration Tests', () => {
    var vm: ARM.Simulator.Vm;

    var bootImage_1 = [
        0x0C, 0x00, 0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA,
        0x05, 0x00, 0x00, 0xEA, 0x00, 0x00, 0xA0, 0xE1, 0x04, 0x00, 0x00, 0xEA, 0x04, 0x00, 0x00, 0xEA,
        0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA,
        0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0x01, 0x00, 0xA0, 0xE3, 0x02, 0x10, 0xA0, 0xE3,
        0x03, 0x00, 0x00, 0xEB, 0x00, 0x20, 0xA0, 0xE1, 0x01, 0x00, 0xA0, 0xE1, 0x02, 0x10, 0xA0, 0xE1,
        0xFA, 0xFF, 0xFF, 0xEA, 0x01, 0x00, 0x80, 0xE0, 0x1E, 0xFF, 0x2F, 0xE1
    ];

    /**
     * Runs before each test method is executed.
     */
    beforeEach(() => {
        // - ARM7 CPU clocked at 6.9824 Mhz
        // - 16kb ROM starting at memory address 0x00000
        // - 32kb RAM starting at memory address 0x40000
        vm = new ARM.Simulator.Vm(
            6.9824, [
                // ROM containing boot image.
                new ARM.Simulator.Region(0x00000, 0x4000, null, ARM.Simulator.Region.NoWrite,
                    bootImage_1),
                new ARM.Simulator.Region(0x40000, 0x8000, null, null)
            ]
        );
        var devices = [
            new ARM.Simulator.Devices.TL16C750(0xE0000000, active => {
            }),
            new ARM.Simulator.Devices.TL16C750(0xE0004000, active => {
            }),
            new ARM.Simulator.Devices.HD44780U(0xE0008000),
            new ARM.Simulator.Devices.PIC(0xE00010000, active_irq => {
            }, active_fiq => {
            }),
            // Timers, GPIO, RTC, Watchdog

        ];
        for (var dev of devices) {
            expect(vm.RegisterDevice(dev)).toBe(true);
        }

    });

    it('Should run', () => {
        var fu: any = vm;

        console.log(fu.cpu.gpr[0]);
        vm.RunFor(1000);
        console.log(fu.cpu.gpr[1]);
        console.log(', ' + fu.cpu.Cycles);

    });
});