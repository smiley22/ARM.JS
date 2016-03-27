///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/DS1307.ts"/>

/**
 * Contains unit-tests for the DS1307 device.
 */
describe('DS1307 Tests', () => {
    var rtc: ARM.Simulator.Devices.DS1307;
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
        rtc = new ARM.Simulator.Devices.DS1307(0, new Date());
        service = new ARM.Simulator.Tests.MockService();
        expect(rtc.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        rtc.OnUnregister();
    });

    /**
     * Ensures converting from and to BCD works as expected.
     */
    it('BCD Conversion', () => {
        var pairs = [
            [23, 0x23],
            [18, 0x18],
            [ 0, 0x00],
            [ 9, 0x09],
            [10, 0x10]
        ];        
        for (var p of pairs) {
            expect(ARM.Simulator.Devices.DS1307.ToBCD(p[0])).toBe(p[1]);
            expect(ARM.Simulator.Devices.DS1307.FromBCD(p[1])).toBe(p[0]);
        }
    });

});