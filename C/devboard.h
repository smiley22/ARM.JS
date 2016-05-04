#ifndef _DEVBOARD_H_
#define _DEVBOARD_H_

/************************************************************************************************
 *																								*
 * This file defines constants for the addresses of the memory-mapped hardware registers of		*
 * the various peripherals of the dev-board. For a detailed description of these registers,		*
 * please look at the manuals in the /Docs directory.                                           *
 *                                                                                              *
 * @author: Torben Könke                                                                        *
 * @date:   02-05-2016                                                                          *
 *																								*
 ************************************************************************************************/

#define MEM_BASE 0xE0000000

/* UART0 */
#define U0RBR           (*((volatile unsigned long *) (MEM_BASE + 0x0000)))
#define U0THR           (*((volatile unsigned long *) (MEM_BASE + 0x0000)))
#define U0DLL           (*((volatile unsigned long *) (MEM_BASE + 0x0000)))
#define U0DLH           (*((volatile unsigned long *) (MEM_BASE + 0x0004)))
#define U0IER           (*((volatile unsigned long *) (MEM_BASE + 0x0004)))
#define U0IIR           (*((volatile unsigned long *) (MEM_BASE + 0x0008)))
#define U0FCR           (*((volatile unsigned long *) (MEM_BASE + 0x0008)))
#define U0LCR           (*((volatile unsigned long *) (MEM_BASE + 0x000C)))
#define U0LSR           (*((volatile unsigned long *) (MEM_BASE + 0x0014)))
#define U0SCR           (*((volatile unsigned long *) (MEM_BASE + 0x001C)))

/* UART1 */
#define U1RBR           (*((volatile unsigned long *) (MEM_BASE + 0x4000)))
#define U1THR           (*((volatile unsigned long *) (MEM_BASE + 0x4000)))
#define U1DLL           (*((volatile unsigned long *) (MEM_BASE + 0x4000)))
#define U1DLH           (*((volatile unsigned long *) (MEM_BASE + 0x4004)))
#define U1IER           (*((volatile unsigned long *) (MEM_BASE + 0x4004)))
#define U1IIR           (*((volatile unsigned long *) (MEM_BASE + 0x4008)))
#define U1FCR           (*((volatile unsigned long *) (MEM_BASE + 0x4008)))
#define U1LCR           (*((volatile unsigned long *) (MEM_BASE + 0x400C)))
#define U1LSR           (*((volatile unsigned long *) (MEM_BASE + 0x4014)))
#define U1SCR           (*((volatile unsigned long *) (MEM_BASE + 0x401C)))

/* Hitachi HD44780U LCD Controller */
#define LCDIOCTL        (*((volatile unsigned long *) (MEM_BASE + 0x8000)))
#define LCDDATA         (*((volatile unsigned long *) (MEM_BASE + 0x8004)))

/* Samsung S3C4510B Interrupt Controller */
#define INTMOD          (*((volatile unsigned long *) (MEM_BASE + 0x10000)))
#define INTPND          (*((volatile unsigned long *) (MEM_BASE + 0x10004)))
#define INTMSK          (*((volatile unsigned long *) (MEM_BASE + 0x10008)))
#define INTPRI0         (*((volatile unsigned long *) (MEM_BASE + 0x1000C)))
#define INTPRI1         (*((volatile unsigned long *) (MEM_BASE + 0x10010)))
#define INTPRI2         (*((volatile unsigned long *) (MEM_BASE + 0x10014)))
#define INTPRI3         (*((volatile unsigned long *) (MEM_BASE + 0x10018)))
#define INTPRI4         (*((volatile unsigned long *) (MEM_BASE + 0x1001C)))
#define INTPRI5         (*((volatile unsigned long *) (MEM_BASE + 0x10020)))
#define INTOFFSET       (*((volatile unsigned long *) (MEM_BASE + 0x10024)))
#define INTOSET_FIQ     (*((volatile unsigned long *) (MEM_BASE + 0x10028)))
#define INTOSET_IRQ     (*((volatile unsigned long *) (MEM_BASE + 0x1002C)))
#define INTPNDPRI       (*((volatile unsigned long *) (MEM_BASE + 0x10030)))
#define INTPNDTST       (*((volatile unsigned long *) (MEM_BASE + 0x10034)))

// Timer 0
#define T0MOD			(*((volatile unsigned long *) (MEM_BASE + 0x14000)))
#define T0CNT			(*((volatile unsigned long *) (MEM_BASE + 0x14004)))
#define T0CMP			(*((volatile unsigned long *) (MEM_BASE + 0x14008)))

// Timer 1
#define T1MOD			(*((volatile unsigned long *) (MEM_BASE + 0x18000)))
#define T1CNT			(*((volatile unsigned long *) (MEM_BASE + 0x18014)))
#define T1CMP			(*((volatile unsigned long *) (MEM_BASE + 0x18018)))

// General Purpose I/O
#define IO0PIN			(*((volatile unsigned long *) (MEM_BASE + 0x1C000)))
#define IO0DIR			(*((volatile unsigned long *) (MEM_BASE + 0x1C004)))
#define IO0SET			(*((volatile unsigned long *) (MEM_BASE + 0x1C008)))
#define IO0CLR			(*((volatile unsigned long *) (MEM_BASE + 0x1C00C)))
#define IO1PIN			(*((volatile unsigned long *) (MEM_BASE + 0x1C010)))
#define IO1DIR			(*((volatile unsigned long *) (MEM_BASE + 0x1C014)))
#define IO1SET			(*((volatile unsigned long *) (MEM_BASE + 0x1C018)))
#define IO1CLR			(*((volatile unsigned long *) (MEM_BASE + 0x1C01C)))

// DS1307 Real-Time-Clock
#define RTCSEC			(*((volatile unsigned long *) (MEM_BASE + 0x20000)))
#define RTCMIN			(*((volatile unsigned long *) (MEM_BASE + 0x20001)))
#define RTCHRS			(*((volatile unsigned long *) (MEM_BASE + 0x20002)))
#define RTCDAY			(*((volatile unsigned long *) (MEM_BASE + 0x20003)))
#define RTCDATE			(*((volatile unsigned long *) (MEM_BASE + 0x20004)))
#define RTCMON			(*((volatile unsigned long *) (MEM_BASE + 0x20005)))
#define RTCYEAR			(*((volatile unsigned long *) (MEM_BASE + 0x20006)))
#define RTCCTRL			(*((volatile unsigned long *) (MEM_BASE + 0x20007)))
#define RTCRAM			(*((volatile unsigned long *) (MEM_BASE + 0x20008)))
#define RTCRAMSIZE		0x38

// Watchdog Timer
#define WDGCTRL			(*((volatile unsigned long *) (MEM_BASE + 0x24000)))
#define WDGPRLD			(*((volatile unsigned long *) (MEM_BASE + 0x24004)))
#define WDGKEY			(*((volatile unsigned long *) (MEM_BASE + 0x24008)))
#define WDKCNT			(*((volatile unsigned long *) (MEM_BASE + 0x2400C)))

/* System Control Block */
#define PCON            (*((volatile unsigned long *) (MEM_BASE + 0x1FC000)))



#endif /* _DEVBOARD_H_ */