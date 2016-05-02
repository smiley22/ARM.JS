#ifndef _DEVBOARD_H_
#define _DEVBOARD_H_

/************************************************************************************************
 *																								*
 * This file defines constants for the addresses of the memory-mapped hardware registers of		*
 * the various peripherals of the dev-board. For a detailed description of these registers,		*
 * please look at the manuals in the /Docs directory.
 *
 * @author: Torben Könke
 * @date:   02-05-2016
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

/* LED0-8 */
#define LEDSTAT         (*((volatile unsigned long *) (MEM_BASE + 0x8000)))

/* Hitachi HD44780U LCD Controller */
#define LCDIOCTL        (*((volatile unsigned long *) (MEM_BASE + 0xC000)))
#define LCDDATA         (*((volatile unsigned long *) (MEM_BASE + 0xC004)))

/* BUTTON0-9 */
#define BTNSTAT         (*((volatile unsigned long *) (MEM_BASE + 0x10000)))

/* Interrupt Controller */
#define INTMOD          (*((volatile unsigned long *) (MEM_BASE + 0x14000)))
#define INTPND          (*((volatile unsigned long *) (MEM_BASE + 0x14004)))
#define INTMSK          (*((volatile unsigned long *) (MEM_BASE + 0x14008)))
#define INTPRI0         (*((volatile unsigned long *) (MEM_BASE + 0x1400C)))
#define INTPRI1         (*((volatile unsigned long *) (MEM_BASE + 0x14010)))
#define INTPRI2         (*((volatile unsigned long *) (MEM_BASE + 0x14014)))
#define INTPRI3         (*((volatile unsigned long *) (MEM_BASE + 0x14018)))
#define INTPRI4         (*((volatile unsigned long *) (MEM_BASE + 0x1401C)))
#define INTPRI5         (*((volatile unsigned long *) (MEM_BASE + 0x14020)))
#define INTOFFSET       (*((volatile unsigned long *) (MEM_BASE + 0x14024)))
#define INTOSET_FIQ     (*((volatile unsigned long *) (MEM_BASE + 0x14028)))
#define INTOSET_IRQ     (*((volatile unsigned long *) (MEM_BASE + 0x1402C)))
#define INTPNDPRI       (*((volatile unsigned long *) (MEM_BASE + 0x14030)))
#define INTPNDTST       (*((volatile unsigned long *) (MEM_BASE + 0x14034)))

/* System Control Block */
#define PCON            (*((volatile unsigned long *) (MEM_BASE + 0x1FC000)))

/* LED bit flags */
#define LED0                        (1 << 0)
#define LED1                        (1 << 1)
#define LED2                        (1 << 2)
#define LED3                        (1 << 3)
#define LED4                        (1 << 4)
#define LED5                        (1 << 5)
#define LED6                        (1 << 6)
#define LED7                        (1 << 7)

/* Push-button bit flags */
#define BTN0                        (1 << 0)
#define BTN1                        (1 << 1)
#define BTN2                        (1 << 2)
#define BTN3                        (1 << 3)
#define BTN4                        (1 << 4)
#define BTN5                        (1 << 5)
#define BTN6                        (1 << 6)
#define BTN7                        (1 << 7)
#define BTN8                        (1 << 8)
#define BTN9                        (1 << 9)


#endif /* _DEVBOARD_H_ */