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

    var issueCommand = (word: number) => {
        var values = [
            [0x00, 0x04],   // ioctl: RS Low, RW Low, E High.
            [0x04, word],   // data
            [0x00, 0x00]    // ioctl: E Low.
        ];
        for (var pair of values)
            lcd.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
    }

    var checkBusyFlag = () => {
        var values = [
            [0x00, 0x06],   // RS Low, R/W High, E High.
            [0x00, 0x02]    // RS Low, R/W High, E Low.
        ];
        for (var pair of values)
            lcd.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        var ret = lcd.Read(0x04, ARM.Simulator.DataType.Word);

        return ((ret >> 7) & 0x01) == 1;
    }


    it('Busy Flag', () => {
        expect(checkBusyFlag()).toBe(false);
        issueCommand(0x20);
        expect(checkBusyFlag()).toBe(true);
        jasmine.clock().tick(0.1);
        expect(checkBusyFlag()).toBe(false);
    });
});