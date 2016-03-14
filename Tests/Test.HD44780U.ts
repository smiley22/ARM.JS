///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/HD44780U.ts"/>

/**
 * Contains unit-tests for the HD44780U device.
 */
describe('HD44780U Tests', () => {
    var lcd: ARM.Simulator.Devices.HD44780U;
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
        lcd = new ARM.Simulator.Devices.HD44780U(0);
        service = new ARM.Simulator.Tests.MockService();
        expect(lcd.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        lcd.OnUnregister();
    });

    it('Execution Time', () => {
        // Issue 'Return Home' instruction, ensure BF is set for ~1.52ms.
        // Issue 'Entry Mode Set' instruction, ensure BF is set for ~37µs.
    });
});