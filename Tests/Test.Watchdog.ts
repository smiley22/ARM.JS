///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/Watchdog.ts"/>

/**
 * Contains unit-tests for the Watchdog device.
 */
describe('Watchdog Tests', () => {
    var watchdog: ARM.Simulator.Devices.Watchdog;
    var service: ARM.Simulator.Tests.MockService;

    /**
     * Sets up the text fixture. Runs before the first test is executed.
     */
    beforeAll(() => {
        // Hooks JS' setTimeout and setInterval functions, so we can test timing-dependent code.
        jasmine.clock().install();
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
        watchdog = new ARM.Simulator.Devices.Watchdog(0);
        service = new ARM.Simulator.Tests.MockService();
        expect(watchdog.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        watchdog.OnUnregister();
    });

    /**
     * Advances the simulation time by the specified amount of milliseconds.
     * 
     * @param ms
     *  The amount of milliseconds to advance time.
     */
    var tick = (ms: number) => {
        jasmine.clock().tick(ms);
    }

    /**
     * Ensures watchdog registers contain default values after reset.
     */
    it('Reset Values', () => {
        // See 'TMS470R1x Digital Watchdog Reference Guide' - 4.Internal Registers
        var registers = [
            [0x00, 0x5312ACED],   // Control register
            [0x04, 0x00000FFF],   // Preload register
            [0x08, 0x00000000],   // Key register
            [0x0C, 0x01FFFFFF]    // Counter register
        ];
        for (var entry of registers) {
            var value = watchdog.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });

    /**
     * Ensures the countdown timings based on a 4 Mhz oscillator correspond to those
     * outlined in the manual.
     */
    it('Counter Timings', () => {
        // See 2.1.1 Setting up the DWD, p.4:
        // 2^25 / 4Mhz = 8,388608s
        var expectedTime = 8.388608 * 1000;
        // Load preload register with 4096 and enable watchdog.
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        expect(service.RaisedEvents.length).toBe(0);
        tick(expectedTime - 10);
        expect(service.RaisedEvents.length).toBe(0);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        expect(service.RaisedEvents[0][0]).toBe('Watchdog.Reset');
    });

    /**
     * Ensures the counter is reloaded when the proper sequence is written to the
     * key register.
     */
    it('Counter Reload', () => {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        var start = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(start).toBe(0x0FFF);
        tick(1000);
        var counter = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(counter).toBeLessThan(start);
        // Reload counter by writing proper sequence to the key register.
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0xE51A);
        tick(10);
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0xA35C);
        tick(10);
        // Counter should have been reloaded with preload register.
        var reloaded = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(reloaded).toBeGreaterThan(counter);
    });

    /**
     * Ensures that writing an invalid value to the key register causes a system
     * reset.
     */
    it('Invalid Key Value', () => {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        expect(service.RaisedEvents.length).toBe(0);
        tick(1000);
        expect(service.RaisedEvents.length).toBe(0);
        // Writing anything other than 0xE51A or 0xA35C to the key register should
        // cause a system reset.
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0x12345678);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        expect(service.RaisedEvents[0][0]).toBe('Watchdog.Reset');
    });

    /**
     * Ensures the watchdog timer cannot be disabled anymore once it's been started.
     */
    it('Cannot be disabled', () => {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        tick(10);
        expect(watchdog.Read(0, ARM.Simulator.DataType.Word)).toBe(0xACED5312);
        // Writes to control register should be ignored.
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0x5312ACED);
        var counter = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        tick(10);
        // Control register should still have it's old value and counter should still
        // be counting down.
        expect(watchdog.Read(0, ARM.Simulator.DataType.Word)).toBe(0xACED5312);
        expect(watchdog.Read(0x0C, ARM.Simulator.DataType.Word)).toBeLessThan(counter);
        // Shouldn't be able to change preload register anymore, either.
        expect(watchdog.Read(4, ARM.Simulator.DataType.Word)).toBe(0x0FFF);
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x1234);
        tick(10);
        expect(watchdog.Read(4, ARM.Simulator.DataType.Word)).toBe(0x0FFF);
    });
});