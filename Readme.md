### Introduction

ARM.JS is a simulator for the ARMv4T instruction set architecture (as is used by the ARM7TDMI and others), written in TypeScript/JavaScript. It also features a GNU-like ARM assembler. You can [try it out](http://smiley22.github.io/ARM.JS/) in your favourite web browser.

You can also compile your own C programs using the GNU ARM Embedded Toolchain and then run them in the simulator in your browser. 

To make things a bit more interesting, the project provides a simple virtual development board with a couple of hardware devices to play around with. More specifically, the virtual dev-board features:

* ARM7-like Processor
* 512kb flash ROM
* 32kb static RAM
* 8 LEDs
* 10 Push Buttons (Mapped to Keyboard keys 0-9)
* 2-line HITACHI HD44780-compliant LCD
* Programmable Interrupt Controller
* 2x UARTs (National Semiconductor 16750 compatible)
* 2 Programmable Timers
* Watchdog Timer
* Real Time Clock (DS1307)

You can take a look at the [datasheet](Docs/DevBoard_Datasheet.pdf) for the memory map and a description of the memory-mapped HW registers. Or just look at the provided ARM assembly and [C program examples](C/).

This project is purely academic in service of my personal curiosity.


### Credits

This project is copyright © 2016 Torben Könke.


### License

This project is released under the [GNU General Public License (GPL)](http://www.gnu.org/licenses/old-licenses/gpl-2.0.txt).
