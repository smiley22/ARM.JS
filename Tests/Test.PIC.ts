///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/PIC.ts"/>

/**
 * Contains unit-tests for the PIC device.
 */
describe('PIC Tests', () => {
    var pic: ARM.Simulator.Devices.PIC;
    var service: ARM.Simulator.Tests.MockService;
    var irq: (active: boolean) => void = null;
    var fiq: (active: boolean) => void = null;
    var clockRate = 58.9824; // Mhz

    /**
     * Sets up the text fixture. Runs before the first test is executed.
     */
    beforeAll(() => {
        // Hooks JS' setTimeout and setInterval functions, so we can test timing-dependent code.
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });

    /**
     * Tear down the test fixture. Runs after all test methods have been run.
     */
    afterAll(() => {
        jasmine.clock().uninstall();
    });

    /**
     * Runs before each test method is executed.
     */
    beforeEach(() => {
        pic = new ARM.Simulator.Devices.PIC(0, active => {
            if (irq != null)
                irq(active);
        }, active => {
            if (fiq != null)
                fiq(active);
        });
        service = new ARM.Simulator.Tests.MockService(clockRate);
        expect(pic.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        irq = null;
        fiq = null;
        pic.OnUnregister();
    });

    /**
     * Advances the simulation time by the specified amount of milliseconds.
     * 
     * @param ms
     *  The amount of milliseconds to advance time.
     */
    var tick = (ms: number) => {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    }

    /**
     * Ensures PIC registers contain default values after reset.
     */
    it('Reset Values', () => {
        // Taken from hardware manuals.
        var registers = [
            [0x00, 0x00000000],  // Mode Register
            [0x04, 0x00000000],  // Pending Register
            [0x08, 0x003FFFFF],  // Mask Register
            [0x0C, 0x03020100],  // Priority Register 0
            [0x10, 0x07060504],  // Priority Register 1
            [0x14, 0x0B0A0908],  // Priority Register 2
            [0x18, 0x0F0E0D0C],  // Priority Register 3
            [0x1C, 0x13121110],  // Priority Register 4
            [0x20, 0x00000014],  // Priority Register 5
            [0x24, 0x00000054],  // Offset Register
            [0x28, 0x00000000],  // Pending by Priority Register
            [0x30, 0x00000054],  // FIQ Offset Register
            [0x34, 0x00000054],  // IRQ Offset Register
        ];
        for (var entry of registers) {
            var value = pic.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
});