﻿///<reference path="jasmine.d.ts"/>
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
    var elf: ARM.Simulator.Elf.Elf32;
    var uart0: ARM.Simulator.Devices.TL16C750;
    var output = '';

    /**
     * Compiled ELF image containing test logic. For program source-code and linker setup, see
     * integration.c, startup.S and linker.ld in the ../C directory of the solution.
     */
    var bootImage = [
        0x7F, 0x45, 0x4C, 0x46, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x28, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x34, 0x00,
        0x00, 0x00, 0x5C, 0x08, 0x00, 0x00, 0x00, 0x02, 0x00, 0x05,
        0x34, 0x00, 0x20, 0x00, 0x02, 0x00, 0x28, 0x00, 0x09, 0x00,
        0x06, 0x00, 0x01, 0x00, 0x00, 0x00, 0x74, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0x02,
        0x00, 0x00, 0x78, 0x02, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0xEC, 0x02,
        0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x00,
        0x07, 0x00, 0x00, 0x00, 0x08, 0x01, 0x00, 0x00, 0x06, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x0C, 0x00, 0x00, 0xEA,
        0x05, 0x00, 0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA, 0x05, 0x00,
        0x00, 0xEA, 0x05, 0x00, 0x00, 0xEA, 0x00, 0x00, 0xA0, 0xE1,
        0x04, 0x00, 0x00, 0xEA, 0x04, 0x00, 0x00, 0xEA, 0xFE, 0xFF,
        0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA,
        0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF, 0xFF, 0xEA, 0xFE, 0xFF,
        0xFF, 0xEA, 0x00, 0x00, 0xA0, 0xE3, 0x28, 0x10, 0x9F, 0xE5,
        0x28, 0x20, 0x9F, 0xE5, 0x02, 0x00, 0x51, 0xE1, 0x01, 0x00,
        0x00, 0x0A, 0x01, 0x00, 0xC1, 0xE4, 0xFB, 0xFF, 0xFF, 0xEA,
        0x12, 0x09, 0xA0, 0xE3, 0x00, 0xD0, 0xA0, 0xE1, 0x76, 0x00,
        0x00, 0xEB, 0x0C, 0x00, 0x9F, 0xE5, 0x01, 0x10, 0xA0, 0xE3,
        0x00, 0x10, 0xC0, 0xE5, 0x07, 0x00, 0x04, 0x00, 0x08, 0x01,
        0x04, 0x00, 0x00, 0xC0, 0x1F, 0xE0, 0x04, 0xB0, 0x2D, 0xE5,
        0x00, 0xB0, 0x8D, 0xE2, 0x4E, 0x32, 0xA0, 0xE3, 0x00, 0x20,
        0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0xCE, 0x32, 0xA0, 0xE3,
        0x80, 0x20, 0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0x0E, 0x32,
        0xA0, 0xE3, 0x03, 0x20, 0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5,
        0x4E, 0x32, 0xA0, 0xE3, 0x00, 0x20, 0xA0, 0xE3, 0x00, 0x20,
        0x83, 0xE5, 0xCE, 0x32, 0xA0, 0xE3, 0x03, 0x20, 0xA0, 0xE3,
        0x00, 0x20, 0x83, 0xE5, 0x8E, 0x32, 0xA0, 0xE3, 0xC7, 0x20,
        0xA0, 0xE3, 0x00, 0x20, 0x83, 0xE5, 0x00, 0x00, 0xA0, 0xE1,
        0x00, 0xD0, 0x4B, 0xE2, 0x04, 0xB0, 0x9D, 0xE4, 0x1E, 0xFF,
        0x2F, 0xE1, 0x04, 0xB0, 0x2D, 0xE5, 0x00, 0xB0, 0x8D, 0xE2,
        0x0C, 0xD0, 0x4D, 0xE2, 0x00, 0x30, 0xA0, 0xE1, 0x05, 0x30,
        0x4B, 0xE5, 0x00, 0x00, 0xA0, 0xE1, 0x28, 0x30, 0x9F, 0xE5,
        0x00, 0x30, 0x93, 0xE5, 0x20, 0x30, 0x03, 0xE2, 0x00, 0x00,
        0x53, 0xE3, 0xFA, 0xFF, 0xFF, 0x0A, 0x0E, 0x22, 0xA0, 0xE3,
        0x05, 0x30, 0x5B, 0xE5, 0x00, 0x30, 0x82, 0xE5, 0x00, 0x00,
        0xA0, 0xE1, 0x00, 0xD0, 0x4B, 0xE2, 0x04, 0xB0, 0x9D, 0xE4,
        0x1E, 0xFF, 0x2F, 0xE1, 0x14, 0x00, 0x00, 0xE0, 0x00, 0x48,
        0x2D, 0xE9, 0x04, 0xB0, 0x8D, 0xE2, 0x08, 0xD0, 0x4D, 0xE2,
        0x08, 0x00, 0x0B, 0xE5, 0x06, 0x00, 0x00, 0xEA, 0x08, 0x30,
        0x1B, 0xE5, 0x00, 0x30, 0xD3, 0xE5, 0x03, 0x00, 0xA0, 0xE1,
        0xE3, 0xFF, 0xFF, 0xEB, 0x08, 0x30, 0x1B, 0xE5, 0x01, 0x30,
        0x83, 0xE2, 0x08, 0x30, 0x0B, 0xE5, 0x08, 0x30, 0x1B, 0xE5,
        0x00, 0x30, 0xD3, 0xE5, 0x00, 0x00, 0x53, 0xE3, 0xF4, 0xFF,
        0xFF, 0x1A, 0x00, 0x00, 0xA0, 0xE1, 0x04, 0xD0, 0x4B, 0xE2,
        0x00, 0x48, 0xBD, 0xE8, 0x1E, 0xFF, 0x2F, 0xE1, 0x04, 0xB0,
        0x2D, 0xE5, 0x00, 0xB0, 0x8D, 0xE2, 0x00, 0x00, 0xA0, 0xE1,
        0x28, 0x30, 0x9F, 0xE5, 0x00, 0x30, 0x93, 0xE5, 0x01, 0x30,
        0x03, 0xE2, 0x00, 0x00, 0x53, 0xE3, 0xFA, 0xFF, 0xFF, 0x0A,
        0x0E, 0x32, 0xA0, 0xE3, 0x00, 0x30, 0x93, 0xE5, 0xFF, 0x30,
        0x03, 0xE2, 0x03, 0x00, 0xA0, 0xE1, 0x00, 0xD0, 0x4B, 0xE2,
        0x04, 0xB0, 0x9D, 0xE4, 0x1E, 0xFF, 0x2F, 0xE1, 0x14, 0x00,
        0x00, 0xE0, 0x00, 0x48, 0x2D, 0xE9, 0x04, 0xB0, 0x8D, 0xE2,
        0x08, 0xD0, 0x4D, 0xE2, 0x00, 0x30, 0xA0, 0xE3, 0x08, 0x30,
        0x0B, 0xE5, 0x08, 0x00, 0x00, 0xEA, 0x08, 0x30, 0x1B, 0xE5,
        0x01, 0x20, 0x83, 0xE2, 0x08, 0x20, 0x0B, 0xE5, 0x58, 0x10,
        0x9F, 0xE5, 0x09, 0x20, 0x5B, 0xE5, 0x03, 0x20, 0xC1, 0xE7,
        0x09, 0x30, 0x5B, 0xE5, 0x0A, 0x00, 0x53, 0xE3, 0x06, 0x00,
        0x00, 0x0A, 0xDF, 0xFF, 0xFF, 0xEB, 0x00, 0x30, 0xA0, 0xE1,
        0x09, 0x30, 0x4B, 0xE5, 0x09, 0x30, 0x5B, 0xE5, 0x00, 0x00,
        0x53, 0xE3, 0xF0, 0xFF, 0xFF, 0x1A, 0x00, 0x00, 0x00, 0xEA,
        0x00, 0x00, 0xA0, 0xE1, 0x20, 0x20, 0x9F, 0xE5, 0x08, 0x30,
        0x1B, 0xE5, 0x03, 0x30, 0x82, 0xE0, 0x00, 0x20, 0xA0, 0xE3,
        0x00, 0x20, 0xC3, 0xE5, 0x0C, 0x30, 0x9F, 0xE5, 0x03, 0x00,
        0xA0, 0xE1, 0x04, 0xD0, 0x4B, 0xE2, 0x00, 0x48, 0xBD, 0xE8,
        0x1E, 0xFF, 0x2F, 0xE1, 0x08, 0x00, 0x04, 0x00, 0x00, 0x48,
        0x2D, 0xE9, 0x04, 0xB0, 0x8D, 0xE2, 0x8B, 0xFF, 0xFF, 0xEB,
        0x24, 0x00, 0x9F, 0xE5, 0xB4, 0xFF, 0xFF, 0xEB, 0xD7, 0xFF,
        0xFF, 0xEB, 0x00, 0x30, 0xA0, 0xE1, 0x03, 0x00, 0xA0, 0xE1,
        0xB0, 0xFF, 0xFF, 0xEB, 0x00, 0x30, 0xA0, 0xE3, 0x03, 0x00,
        0xA0, 0xE1, 0x04, 0xD0, 0x4B, 0xE2, 0x00, 0x48, 0xBD, 0xE8,
        0x1E, 0xFF, 0x2F, 0xE1, 0x00, 0x00, 0x04, 0x00, 0x65, 0x63,
        0x68, 0x6F, 0x3A, 0x20, 0x00, 0x41, 0x2B, 0x00, 0x00, 0x00,
        0x61, 0x65, 0x61, 0x62, 0x69, 0x00, 0x01, 0x21, 0x00, 0x00,
        0x00, 0x05, 0x41, 0x52, 0x4D, 0x37, 0x54, 0x44, 0x4D, 0x49,
        0x00, 0x06, 0x02, 0x08, 0x01, 0x09, 0x01, 0x12, 0x04, 0x14,
        0x01, 0x15, 0x01, 0x17, 0x03, 0x18, 0x01, 0x1A, 0x01, 0x47,
        0x43, 0x43, 0x3A, 0x20, 0x28, 0x47, 0x4E, 0x55, 0x20, 0x54,
        0x6F, 0x6F, 0x6C, 0x73, 0x20, 0x66, 0x6F, 0x72, 0x20, 0x41,
        0x52, 0x4D, 0x20, 0x45, 0x6D, 0x62, 0x65, 0x64, 0x64, 0x65,
        0x64, 0x20, 0x50, 0x72, 0x6F, 0x63, 0x65, 0x73, 0x73, 0x6F,
        0x72, 0x73, 0x29, 0x20, 0x35, 0x2E, 0x33, 0x2E, 0x31, 0x20,
        0x32, 0x30, 0x31, 0x36, 0x30, 0x33, 0x30, 0x37, 0x20, 0x28,
        0x72, 0x65, 0x6C, 0x65, 0x61, 0x73, 0x65, 0x29, 0x20, 0x5B,
        0x41, 0x52, 0x4D, 0x2F, 0x65, 0x6D, 0x62, 0x65, 0x64, 0x64,
        0x65, 0x64, 0x2D, 0x35, 0x2D, 0x62, 0x72, 0x61, 0x6E, 0x63,
        0x68, 0x20, 0x72, 0x65, 0x76, 0x69, 0x73, 0x69, 0x6F, 0x6E,
        0x20, 0x32, 0x33, 0x34, 0x35, 0x38, 0x39, 0x5D, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x02, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x04, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x05, 0x00, 0x01, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0xF1, 0xFF, 0x0B, 0x00, 0x00, 0x00, 0x38, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x1A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x1D, 0x00, 0x00, 0x00,
        0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x30, 0x00, 0x00, 0x00, 0x24, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x42, 0x00,
        0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x54, 0x00, 0x00, 0x00, 0x2C, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x62, 0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x6F, 0x00, 0x00, 0x00,
        0x34, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x7C, 0x00, 0x00, 0x00, 0x38, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x84, 0x00,
        0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x87, 0x00, 0x00, 0x00, 0x54, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x8A, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x1F, 0xE0, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xF1, 0xFF, 0x9C, 0x00, 0x00, 0x00,
        0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xF1, 0xFF, 0xA5, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF1, 0xFF, 0xAE, 0x00,
        0x00, 0x00, 0x00, 0x80, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xF1, 0xFF, 0xB7, 0x00, 0x00, 0x00, 0x60, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0xBD, 0x00, 0x00, 0x00, 0x6C, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xC0, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
        0xF1, 0xFF, 0x1A, 0x00, 0x00, 0x00, 0x78, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xBD, 0x00,
        0x00, 0x00, 0x20, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x1A, 0x00, 0x00, 0x00, 0x24, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
        0xBD, 0x00, 0x00, 0x00, 0xB0, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x1A, 0x00, 0x00, 0x00,
        0xB4, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0xBD, 0x00, 0x00, 0x00, 0x38, 0x02, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xCE, 0x00,
        0x00, 0x00, 0x08, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x03, 0x00, 0xBD, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00,
        0x1A, 0x00, 0x00, 0x00, 0x3C, 0x02, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xBD, 0x00, 0x00, 0x00,
        0x74, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0xBD, 0x00, 0x00, 0x00, 0x08, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0xD7, 0x00,
        0x00, 0x00, 0xD8, 0x00, 0x00, 0x00, 0x4C, 0x00, 0x00, 0x00,
        0x12, 0x00, 0x01, 0x00, 0x0A, 0x01, 0x00, 0x00, 0x08, 0x01,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00,
        0xE0, 0x00, 0x00, 0x00, 0x74, 0x01, 0x00, 0x00, 0x40, 0x00,
        0x00, 0x00, 0x12, 0x00, 0x01, 0x00, 0xE9, 0x00, 0x00, 0x00,
        0x07, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x02, 0x00, 0xF7, 0x00, 0x00, 0x00, 0x78, 0x00, 0x00, 0x00,
        0x60, 0x00, 0x00, 0x00, 0x12, 0x00, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x10, 0x00, 0x01, 0x00, 0x09, 0x01, 0x00, 0x00, 0x08, 0x01,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x03, 0x00,
        0x15, 0x01, 0x00, 0x00, 0x08, 0x01, 0x04, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x10, 0x00, 0x03, 0x00, 0x1B, 0x01, 0x00, 0x00,
        0xB4, 0x01, 0x00, 0x00, 0x88, 0x00, 0x00, 0x00, 0x12, 0x00,
        0x01, 0x00, 0x24, 0x01, 0x00, 0x00, 0x07, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x02, 0x00, 0x30, 0x01,
        0x00, 0x00, 0x3C, 0x02, 0x00, 0x00, 0x3C, 0x00, 0x00, 0x00,
        0x12, 0x00, 0x01, 0x00, 0x35, 0x01, 0x00, 0x00, 0x24, 0x01,
        0x00, 0x00, 0x50, 0x00, 0x00, 0x00, 0x12, 0x00, 0x01, 0x00,
        0x3E, 0x01, 0x00, 0x00, 0x07, 0x00, 0x04, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x10, 0x00, 0x02, 0x00, 0x16, 0x01, 0x00, 0x00,
        0x08, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x03, 0x00, 0x45, 0x01, 0x00, 0x00, 0x07, 0x00, 0x04, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x02, 0x00, 0x00, 0x73,
        0x74, 0x61, 0x72, 0x74, 0x75, 0x70, 0x2E, 0x6F, 0x00, 0x52,
        0x65, 0x73, 0x65, 0x74, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74,
        0x69, 0x6F, 0x6E, 0x00, 0x24, 0x61, 0x00, 0x55, 0x6E, 0x64,
        0x65, 0x66, 0x69, 0x6E, 0x65, 0x64, 0x45, 0x78, 0x63, 0x65,
        0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x53, 0x6F, 0x66, 0x74,
        0x77, 0x61, 0x72, 0x65, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74,
        0x69, 0x6F, 0x6E, 0x00, 0x50, 0x72, 0x65, 0x66, 0x65, 0x74,
        0x63, 0x68, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74, 0x69, 0x6F,
        0x6E, 0x00, 0x44, 0x61, 0x74, 0x61, 0x45, 0x78, 0x63, 0x65,
        0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x49, 0x52, 0x51, 0x45,
        0x78, 0x63, 0x65, 0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 0x46,
        0x49, 0x51, 0x45, 0x78, 0x63, 0x65, 0x70, 0x74, 0x69, 0x6F,
        0x6E, 0x00, 0x7A, 0x65, 0x72, 0x6F, 0x62, 0x73, 0x73, 0x00,
        0x6C, 0x31, 0x00, 0x6C, 0x32, 0x00, 0x50, 0x4F, 0x57, 0x45,
        0x52, 0x5F, 0x43, 0x4F, 0x4E, 0x54, 0x52, 0x4F, 0x4C, 0x5F,
        0x52, 0x45, 0x47, 0x00, 0x52, 0x41, 0x4D, 0x5F, 0x53, 0x69,
        0x7A, 0x65, 0x00, 0x52, 0x41, 0x4D, 0x5F, 0x42, 0x61, 0x73,
        0x65, 0x00, 0x54, 0x6F, 0x70, 0x53, 0x74, 0x61, 0x63, 0x6B,
        0x00, 0x5F, 0x65, 0x78, 0x69, 0x74, 0x00, 0x24, 0x64, 0x00,
        0x69, 0x6E, 0x74, 0x65, 0x67, 0x72, 0x61, 0x74, 0x69, 0x6F,
        0x6E, 0x2E, 0x63, 0x00, 0x62, 0x75, 0x66, 0x2E, 0x34, 0x31,
        0x38, 0x34, 0x00, 0x73, 0x69, 0x6F, 0x5F, 0x70, 0x75, 0x74,
        0x63, 0x00, 0x73, 0x69, 0x6F, 0x5F, 0x67, 0x65, 0x74, 0x63,
        0x00, 0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x73, 0x74, 0x61,
        0x72, 0x74, 0x5F, 0x5F, 0x00, 0x73, 0x69, 0x6F, 0x5F, 0x69,
        0x6E, 0x69, 0x74, 0x00, 0x5F, 0x73, 0x74, 0x61, 0x72, 0x74,
        0x75, 0x70, 0x00, 0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x65,
        0x6E, 0x64, 0x5F, 0x5F, 0x00, 0x5F, 0x5F, 0x65, 0x6E, 0x64,
        0x00, 0x73, 0x69, 0x6F, 0x5F, 0x67, 0x65, 0x74, 0x73, 0x00,
        0x5F, 0x5F, 0x62, 0x73, 0x73, 0x5F, 0x73, 0x74, 0x61, 0x72,
        0x74, 0x00, 0x6D, 0x61, 0x69, 0x6E, 0x00, 0x73, 0x69, 0x6F,
        0x5F, 0x70, 0x75, 0x74, 0x73, 0x00, 0x5F, 0x65, 0x64, 0x61,
        0x74, 0x61, 0x00, 0x5F, 0x5F, 0x64, 0x61, 0x74, 0x61, 0x5F,
        0x73, 0x74, 0x61, 0x72, 0x74, 0x00, 0x00, 0x2E, 0x73, 0x79,
        0x6D, 0x74, 0x61, 0x62, 0x00, 0x2E, 0x73, 0x74, 0x72, 0x74,
        0x61, 0x62, 0x00, 0x2E, 0x73, 0x68, 0x73, 0x74, 0x72, 0x74,
        0x61, 0x62, 0x00, 0x2E, 0x74, 0x65, 0x78, 0x74, 0x00, 0x2E,
        0x72, 0x6F, 0x64, 0x61, 0x74, 0x61, 0x00, 0x2E, 0x62, 0x73,
        0x73, 0x00, 0x2E, 0x41, 0x52, 0x4D, 0x2E, 0x61, 0x74, 0x74,
        0x72, 0x69, 0x62, 0x75, 0x74, 0x65, 0x73, 0x00, 0x2E, 0x63,
        0x6F, 0x6D, 0x6D, 0x65, 0x6E, 0x74, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x1B, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x74, 0x00, 0x00, 0x00,
        0x78, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x21, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0xEC, 0x02, 0x00, 0x00,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x29, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x03, 0x00,
        0x00, 0x00, 0x08, 0x00, 0x04, 0x00, 0xF3, 0x02, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x2E, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x70, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF3, 0x02, 0x00, 0x00,
        0x2C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x3E, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x30, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1F, 0x03, 0x00, 0x00,
        0x6E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
        0x11, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x12, 0x08, 0x00, 0x00,
        0x47, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x90, 0x03, 0x00, 0x00,
        0x30, 0x03, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x24, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00,
        0x09, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x06, 0x00, 0x00,
        0x52, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ];

    /**
     * Sets up the text fixture. Runs before the first test is executed.
     */
    beforeAll(() => {
        elf = new ARM.Simulator.Elf.Elf32(bootImage);
    });

    /**
     * Runs before each test method is executed.
     */
    beforeEach(() => {
        // - ARM7 CPU clocked at 6.9824 Mhz
        // - 16kb ROM starting at memory address 0x00000
        // - 32kb RAM starting at memory address 0x40000
        //
        // For a detailed description of the µc's memory-map, see accompanying README files.
        vm = new ARM.Simulator.Vm(
            6.9824, [
                // ROM containing boot code.
                new ARM.Simulator.Region(0x00000, 0x4000, null, ARM.Simulator.Region.NoWrite,
                    elf.Segments.filter(s => s.VirtualAddress < 0x40000)
                        .map(s => { return { offset: s.VirtualAddress, data: s.Bytes } })),
                // RAM containing program .data
                new ARM.Simulator.Region(0x40000, 0x8000, null, null,
                    elf.Segments.filter(s => s.VirtualAddress >= 0x40000)
                        .map(s => { return { offset: s.VirtualAddress, data: s.Bytes } })
                )
            ]
        );
        var pic = new ARM.Simulator.Devices.PIC(0xE00010000, active_irq => {
            // invert and feed into nIRQ of CPU.
            vm.Cpu.nIRQ = !active_irq;
        }, active_fiq => {
            // invert and feed into nFIQ of CPU.
            vm.Cpu.nFIQ = !active_fiq;
            });
        vm.RegisterDevice(pic);

        uart0 = new ARM.Simulator.Devices.TL16C750(0xE0000000, active =>
            pic.SetSignal(0, active)
        );

        var devices = [
            uart0,
            new ARM.Simulator.Devices.TL16C750(
                0xE0004000,
                active => pic.SetSignal(1, active)
            ),
            new ARM.Simulator.Devices.HD44780U(0xE0008000),
            new ARM.Simulator.Devices.Timer(
                0xE00014000,
                active => pic.SetSignal(2, active)
            ),
            new ARM.Simulator.Devices.Timer(
                0xE00018000,
                active => pic.SetSignal(3, active)
            ),
            new ARM.Simulator.Devices.GPIO(0xE0001C000, 2, port => 0,
                (p, v, s, c, d) => { }),
            new ARM.Simulator.Devices.DS1307(0xE00020000, new Date()),
            new ARM.Simulator.Devices.Watchdog(0xE00024000)
        ];
        for (var dev of devices) {
            expect(vm.RegisterDevice(dev)).toBe(true);
        }

        vm.on('TL16C750.Data', (args, sender) => {
            if (sender == uart0)
                output = output + String.fromCharCode(args);
        });

    });

    afterEach(() => {
        if (output != '')
            console.log('UART0 output: ' + output);
        output = '';
    });

    it('Should run', () => {
        var s = "Hello World\n";
        // Give VM some time to run so that we can be sure the UART has been configured before
        // we start inputting data.
        vm.RunFor(100);
        for (var i = 0; i < s.length; i++)
            uart0.SerialInput(s.charCodeAt(i));
        vm.RunFor(1000);
    });
});