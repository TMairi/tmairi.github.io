---
title: Exploring IEEE 754 Arithmetic
author: Mairi
date: 2021-05-10 19:33:00 +0100
categories: [Linux, Mathematics]
tags: [bash, linux, scripting, mathematics]
math: true
comments: false
---
## Foreword

This article will be covering the interesting arithmetic involved in the conversion of a hexadecimal value into an IEEE 754 (Floating-Point) value, in the context of computing. Additionally, this article will present a `BASH` script I wrote to perform such conversions, as well as provide a look into the overall process of developing and testing this script.

## Introduction

Recently, in my spare time, I have been conducting a lot of extra research into the fascinating world of [reverse engineering](https://en.wikipedia.org/wiki/Reverse_engineering), particularly on the disassembly and analysis of binary files. While this topic is not entirely foreign to me given my line of work, I decided to learn the intricacies of a different disassembly tool alongside this research, having only been exposed to the 'standard' tools such as [Ghidra](https://ghidra-sre.org/), [IDA](https://www.hex-rays.com/IDA-pro/) and [GDB](https://www.gnu.org/software/gdb/news/reversible.html) thus far.

This tool I am referring to is actually a framework of disassembly tools collectively called [radare2](https://github.com/radareorg/radare2), or `r2`. While on the surface `r2` looks daunting, it is actually very well documented and follows a rather intuitive syntax. If you are at all unfamiliar with this tool, I highly recommend reading the official `radare2` book, which can be found [here](https://book.rada.re/index.html).

> **ATTENTION**: Please note that while this article will briefly cover usage of the `r2` disassembly tool, I will not be explaining its functions in-depth, nor providing a comprehensive look into the disassembly process. In this article, `r2` is merely being used as a means to highlight a problem which formed the basis of my observation. If you would like to learn more about `r2` in-depth, please refer to the aforementioned book, or [this](https://github.com/ifding/radare2-tutorial) tutorial to get started.

## Disassembling C Variables

While researching how `r2` works, I decided to test its functionality by writing some very basic `C` programs, compiling them, then disassembling the resulting binary file. This would then allow me to compare the assembly output of `r2` to the `C` source code to better understand how to navigate the disassembler, and perform analysis on more complicated binary structures.

Therefore, one of the first programs I compiled was the following `C` program, which simply lists a few common variable data-types, such as `int` (integer), `char` (character), `float` (floating-point) and `double` (higher precision floating-point):

```c
#include <stdio.h>

int main() {
    int a = 42;
    char b = 'M';
    float c = 5.5;
    double d = 3.14;
  
return 0;
}
```

After compiling this code on my Linux system using `gcc`, I then opened the binary file using `r2` and ran the following commands (*output truncated*):

```
[0x00401020]> aaa
[ . . . ]
[0x00401020]> afl
[ . . . ]
[0x00401020]> s main
[0x00401106]> pdf
```

Here, I simply analysed the binary (`aaa`), listed the functions (`afl`), jumped to the address containing the `main` function, and then ran the 'print disassembled function' (`pdf`) command. The resulting output from this command was a low-level look at the `C` source code, but written in assembly (machine) language. The relevant part of this code has been provided below, wherein I also changed the `r2` variable names to make the code slightly more readable:

```
push rbp
mov rbp, rsp
mov dword [int], 0x2a
mov byte [char], 0x4d
movss xmm0, dword [0x00402010]
movss dword [float], xmm0
movsd xmm0, qword [0x00402018]
movsd qword [double], xmm0
mov eax, 0
pop rbp
ret
```

Reviewing assembly code like the sample above can be quite intimidating, however, if you are somewhat familiar with programming languages in general (such as `C` and its derivatives), this code is actually quite easy to understand. Firstly the value of the base pointer register `rbp` is pushed onto the stack and then the value of the stack pointer register `rsp` is stored (copied) into it.

Continuing, the hexadecimal value `0x2a` is then stored in the `rbp-0x4` register (which I renamed to `int`, given I know the source code already) and then the value `0x4d` is stored in the `rbp-0x5` register (renamed to `char`). These two values can already be cross-referenced with our source code, as converting the them into decimal (base 10) using `rax2` gives us the value of our variables:

```
[0x00401106]> rax2 0x2a
42
[0x00401106]> rax2 0x4d
77
```

Here we can see that our integer variable is correct at `42`, as specified in the `C` program. However, we did not specify an integer for the second variable, but a character. Therefore, if we search an ASCII table for the decimal value `77`, we will see that it corresponds to our specified character 'M'. A handy ASCII table can be displayed within `r2` by using the following `rax2` command:

```
[0x00401106]> rax2 -a
```

The next two variables are a little bit more complicated. You might be tempted to simply convert the hexadecimal values you see in square brackets straight to decimal, just like with the integer variable, however doing so would result in the following:

```
[0x00401106]> rax2 0x00402010
4202512
```

This is obviously not the correct value, and in fact, the hexadecimal string we converted does not refer to a value in of itself, but instead an address in memory. Your first clue that this may be related to floating numbers is the [movss](https://wiki.cheatengine.org/index.php?title=Assembler:Commands:MOVSS) command, which moves a single-precision floating-point value from a location in memory to another operand (typically an `XMM` register). In this case, a value at the memory address `0x00402010` is being stored in the `xmm0` register, before being copied to the `rbp-0xc` (renamed to `float`) register.

But what is the value in memory being pushed to the `xmm0` register? Well we know by looking at the source code that it must be the value `5.5`, the question is how do we extrapolate this value using `r2`? In fact, there are two ways we can ascertain the value being moved into the `xmm0` register. The first involves simply looking at a hexadecimal dump of the address being moved into the `xmm0` register, as follows:

```
[0x00401106]> pxw @ 0x00402010
0x00402010  0x40b00000 0x00000000 0x51eb851f 0x40091eb8  ...@.......Q...@
[ . . . ]
```

In the output above, we can see the hexadecimal value `0x40b00000`, which could be our floating point value. To check, we can simply run `rax2` again using the `Fx` parameter to specify a floating-point number:

```
[0x00401106]> rax2 Fx40b00000
5.500000f
```

However, we can further verify that this is the correct value by examining the contents of `xmm0` register, which brings us to the second method we can use. In this method, I create a breakpoint in the code where the value of `xmm0` is moved into the `float` variable, then I execute the binary using `ood` and `dc`. We should then hit our specified breakpoint, at which point we can query the contents of the `xmm0` register:

> **ATTENTION**: It is not recommended to execute a binary using `r2` outside of a virtualised environment, especially when you are dealing with unknown binaries or potential malware. In this case, I created the source code for the binary being analysed, so there is no risk of damage to my system. Please exercise caution when executing binaries unless you know what you are doing.

```
[0x00401115]> dc
hit breakpoint at: 0x40111d
[0x0040111d]> dr xmm0
0x00000000000000000000000040b00000
[0x0040111d]> rax2 Fx00000000000000000000000040b00000
5.500000f
```

As you can see, we get a 16-byte hexadecimal value which matches the previous value of `0x40b00000` we found. Furthermore, as we already demonstrated earlier with `rax2`, this hexadecimal string translates into the floating-point number `5.5`. However, as I am about to show, the next variable, of the `double` data-type, is not as easy to handle.

If we repeat the process we used for the `float` variable, but this time for the `double` variable; these are the results we end up with:

```
[0x00401106]> pxq @ 0x00402018
0x00402018  0x40091eb851eb851f  0x000000343b031b01   ...Q...@...;4...
[ . . . ]
[0x0040111d]> dc
hit breakpoint at: 0x40112a
[0x0040112a]> dr xmm0
0x000000000000000040091eb851eb851f
[0x0040112a]> rax2 Fx40091eb851eb851f
126443839488.000000f
```

This is interesting, it appears that the hexadecimal value `0x40091eb851eb851f` is being moved to the `xmm0` register after the breakpoint I set. This must be our floating-point value of `3.14` as specified in the source code, however as you can see above, it does not seem like `rax2` can translate it. Looking at the manual [page](https://r2wiki.readthedocs.io/en/latest/tools/rax2/) for the `rax2` command, it seems like the conversion between hexadecimal and floating numbers is only possible with a 32-bit hexadecimal value. However, as you can see in the output above, we have a 64-bit hexadecimal value.

## Observation

The answer to the conversion problem is actually quite simple; it seems that `rax2` is only capable of converting a given hexadecimal value into a single precision floating-point value. Since we set the variable `d` in our initial program as a `double` data-type, this means that the hexadecimal value needs to be converted into a double precision floating-point value.

Now the question forms; how do we reliably convert a given 64-bit hexadecimal string into a double precision floating-point value? Well, you always have the option of using online converters to do the calculations for you: [1](https://gregstoll.com/~gregstoll/floattohex/), [2](https://babbage.cs.qc.cuny.edu/IEEE-754.old/32bit.html), [3](https://evanw.github.io/float-toy/), [4](https://www.h-schmidt.net/FloatConverter/IEEE754.html). However, I am going to take a more scientific approach by examining the arithmetic outlined by the [IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) standard, and understanding the mathematics behind how floating-point numbers are calculated by computers.

Additionally, I will also create a `BASH` script using this arithmetic to take hexadecimal strings as input values, then convert them to floating-point values of an appropriate precision.

## Research

### Measurement Precision

At this point you may be wondering what a floating-point number actually refers to, and from looking at the initialised values in the `C` source code, you will likely ascertain that they refer to numbers with decimal points. Such values are very important in the world of physics and mathematics as they allow a greater degree of precision in scientific measurements.

For instance, when you measure the distance between two objects in your household, you will likely use a standard tape measure. On this tape measure, you will be typically be able to use inches, feet, centimetres or millimetres. Using the [SI](https://en.wikipedia.org/wiki/International_System_of_Units) units, you will not be able to measure to a greater degree of precision than the milimeter. For example, you may measure 458 mm, but you would not be able to accurately measure a distance of 458.627 mm[^1].

In ordinary everyday-life, this level of precision will be more than sufficient for most jobs. However, it is important to understand that the level of precision you are working at depends on the [Significant Figures](https://en.wikipedia.org/wiki/Significant_figures) of the number. For instance; the numbers we used earlier have three (458) and six (458.627) significant figures respectively. From this we can derive the **most** significant digit and the **least** significant digit, which are determined by each digits exponent value; the digit with the largest exponent is the most significant, and the digit with the smallest exponent is the least significant, as you would expect.

To further understand this concept of significant figures and exponents, which play a major factor in floating-point arithmetic, it is very important that you are familiar with [Scientific Notation](https://en.wikipedia.org/wiki/Scientific_notation) (also known as 'Standard Form').

### Scientific Notation

In the world of physics; particularly astronomy and astrophysics, scientists will often find themselves performing calculations with exceptionally large or small numbers. Writing these numbers out normally as they appear would be inefficient and tedious. Therefore, scientific notation is commonly used instead to represent these values. For instance, the mass of a proton (in kilograms - `kg`), often denoted by \\(p\\) or \\(p^+\\), written as a real number is as follows[^2]:

\\(0.000000000000000000000000001672621923\\)

Whereas in scientific notation, this value would be written as follows:

\\(1.672621923 × 10^{-27}\\)

You should be able to immediately see how much more convenient it is to write a very small value in this notation. We can easily illustrate this notation by converting it into a formula, as follows:

\\(M × 10^n\\)

In this formula, \\(n\\) is our `exponent` value, denoted by an integer. The \\(M\\) value is known as the `significand` (also commonly referred to as the `coefficient` or `mantissa`)[^3]. Using the scientific notation for the mass of a proton above, we can say that the exponent is `-27` and the `significand` is `1.672621898`. However, it is important to note that this value can also be written as the following:

\\(16.72621923 × 10^{-28}\\)

\\(167.2621923 × 10^{-29}\\)

Hence, this is why we would say that the leading `1` is the most significant digit because its exponent is `-27`. It is also important to note for future reference that in scientific notation, the value is typically always `normalized`. This simply means that there must be one non-zero digit before the decimal point, which can be either positive or negative. In the case of the two additional notations above, they can be considered `de-normalized`, as they consist of multiple digits before the decimal point. Interestingly, this is why such values are referred to as 'floating-point' numbers, as the decimal point seemingly 'floats' between the significant digits.

### Rounding Significant Figures

One issue commonly encountered in the realm of significant digits is that of **rounding**. Since we know that the number of significant digits a value has correlates to its overall precision, this means that data is lost when the value is [rounded off](https://en.wikipedia.org/wiki/Round-off_error). One example is the value for the speed of light in a vacuum, denoted by \\(c\\) and measured in metres per second (m/s), is[^4]:

\\(2.99792458 × 10^8\\)

However, you may see this value being rounded to one significant figure, as shown below:

\\(3 × 10^8\\)

Although this may seem inconsequential, in actuality this may cause accuracy problems when dealing with very precise calculations. The issue of rounding when dealing with the number of significant digits can also be demonstrated with arithmetic involving decimal numbers:

\\(1.8 × 4.49\\)

Here we are multiplying a number with two significant digits against a number with three significant digits. A standard calculator would probably tell you that the result of this multiplication would be `8.08`, however the actual answer would be rounded to `8.1`. This is due to `1.8` only having two significant digits, meaning the answer must also have two significant digits, to account for the difference in precision between the two values. It is important to note that rounding in this way should **ONLY** be performed at the end of the calculation. If we were to then further multiply the original answer by `1.7` for example, you would multiply this by `8.08` and **NOT** `8.1`. This is done to prevent data loss in the calculation[^5].

These types of potential precision errors all factor into floating-point arithmetic. This type of arithmetic in the computing world has been known to have problems with precision and the overall speed of calculation. To address these problems, the IEEE 754 standard was created, which prescribes how floating-point values should be represented in binary arithmetic.

### The IEEE 754 Standard

In 1985, the Institute of Electrical and Electronics Engineers (IEEE) published a technical standard for binary (base-2) floating-point arithmetic, which became known as [IEEE 754-1985](https://standards.ieee.org/standard/754-1985.html). This standard would later be superseded by [IEEE 754-2008](https://standards.ieee.org/standard/754-2008.html), which added a further radix format to the original, specifically radix 10 (also known as the base-10 decimal system). This standard would then again be superseded by the more recent [IEEE-754-2019](https://standards.ieee.org/standard/754-2019.html). If the IEEE seems familiar to you in the cyber industry, you may recognise them from their well-known [IEEE 802](https://en.wikipedia.org/wiki/IEEE_802), which provide a set of standards for Ethernet and wireless networks.

In its current form, IEEE 754 specifies five different floating-point formats in a 'basic' group. These are split into three binary formats, with lengths of 32-bits (single precision), 64-bits (double precision) and 128-bits (quadruple precision). The final two are decimal formats, with lengths of 64-bits and 128-bits[^6]. The three binary formats are represented in the C programming language by the `float`, `double` and `long double` data-types respectively. The standard also defines additional formats, called the 'extended' groups, although these are rarely used and will not be the focus of this article.

Before we dive into the storage of floating-point values, it is important to note that the IEEE 754 standard for floating-point arithmetic does more than just provide formats for these values. The standard also specifies operations such as; addition, subtraction, multiplication, etc. In addition to multiple conversions involving floating-point numbers, such as; converting integers and decimal strings to floating-point values. Finally, the standard also covers exceptions, such as dealing with Non-Numbers (NaN).

The representation of floating-point values, as defined by the IEEE 754 standard is as follows:

\\((-1)^{s} × b^e × M\\)

I like to think of this as a formula, which can be broken down into the following values:

- \\(s\\) : The `sign` value
- \\(b\\) : The `base` system in use
- \\(e\\) : The `exponent` value
- \\(M\\) : The `significand` (or `mantissa`) value

The `base` is simply our radix, which can be either `2`, to represent binary, or `10` to represent decimal. In this case, we will be working primarily with a binary radix, hence we can say at this point that: \\(b = 2\\) . Additionally, it is worth noting that in the IEEE 754 standard, the number of digits in the `significand` determines our level of precision, denoted by \\(p\\). For example; in single precision values, \\(M\\) would consist of 23 bits, with one additional stored as the 'hidden bit' (sometimes known as the 'leading bit'), which will be explained in further detail later[^7].

Finally, the `exponent` is broken up into two additional parameters for granularity, these are:

- \\(emax\\) : The maximum `exponent` value
- \\(emin\\) : The minimum `exponent` value

Since we know what `base` we are working in, we simply need to extract our `sign`, `exponent` and `significand` from the binary string we are working with to complete the conversion. In the disassembly of `C` variables earlier in the article, we found that the hexadecimal string `0x40b00000` corresponded to the floating-point value `5.5`. Using the logic outlined by the IEEE 754 standard, we can take this string as a control variable to hopefully convert it into the correct single precision floating-point value.

### Parameter Breakdown

Now we have our hexadecimal string `0x40b00000`, first of all we need to convert this into binary, since we will be working with a `base` \\(b\\) value of `2`. This is relatively easy to do manually, however you can use the `bc` tool on Linux to do this conversion for you. For example, the following command will convert our hexadecimal string to binary on the command-line[^8]:

```shell
$  echo "obase=2; ibase=16; 40B00000" | bc
```

> **ATTENTION**: Please note that `bc` will strip leading 0s from the output, so be sure to restore them or use another method of conversion.

This hexadecimal value will result in the following binary string:

- `0100 0000 1011 0000 0000 0000 0000 0000`

We have a 32-bit binary value, which can now be broken down into our desired parameters. Since we are dealing with a single precision value; the binary string will be broken down as follows:

```plaintext
BIT NO.:	|  31  | 30                   23  | 22                                                                 0 |
BINARY:		|   0  |  1  0  0  0  0  0  0  1  |  0  1  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0 |
PARAMETER:	| Sign |         Exponent         |                                Significand                           |
```

Here we can see that `23` bits are allocated for the `significand`, `8` bits for the `exponent` and the final bit for our `sign`. When dealing with double (64-bit) or quadruple (128-bit) precision values, simply refer to the following table to ascertain how many bits in the binary string to assign to each parameter[^9]:

| | SINGLE | DOUBLE | QUADRUPLE |
| - | :-: | :-: | :-: |
| **SIGN** | 1 | 1 | 1 |
| **EXPONENT** | 8 | 11 | 15 |
| **SIGNIFICAND** | 23 | 52 | 112 |

### Sign

First, we shall take a look at the value of the `sign`; \\(s\\) . In the example above, we can see that our `sign` simply has the value `0`. Therefore, substituting this value into the formula, we will get the following:

\\((-1)^{0} × 2^e × M\\)

Here, we can calculate \\((-1)^0\\) to be `1`, therefore we now know that our resulting floating-point value will be a positive number. The only other value \\(s\\) can possibly be is `1`, which will result in \\((-1)^1\\) which equals `-1`. Hence, we can reliably determine that when \\(s\\) equals `1`, the floating-point value is negative, and when \\(s\\) equals `0`, it will be positive. Finally, we can say that our formula for the conversion at this stage will now be:

\\(1 × 2^e × M\\)

### Exponent

Now for the `exponent` value; \\(e\\) . In our example, the bits covering this parameter are `10000001`, which we can convert into decimal form to get our value for \\(e\\) . Again, this is relatively easy to do manually, however we can use the Linux tool `bc` to perform this conversion for us:

```shell
$  echo "obase=10; ibase=2; 10000001" | bc
```

This command will result in a value of `129`. Now you may be tempted to push this value straight into the formula, however there is one further variable we need to account for. The `exponent` in this case is actually [biased](https://en.wikipedia.org/wiki/Exponent_bias), meaning before we proceed with further calculations, the `biased exponent` must be adjusted[^10].

To understand what a `biased exponent` actually is, we first need to review how signed (positive or negative) integers are stored. Typically, signed integers will be represented by [two's complement](https://en.wikipedia.org/wiki/Two%27s_complement), which enables computers to make calculations using binary values. It follows a simple arithmetic; you have a fixed number of bits used to store the data, the most significant digit is the `sign` (as discussed earlier), the two's complement is then calculated by inverting the bits and adding `1`[^11].

Two's complement is very useful for storing negative numbers in binary form. For instance, if a computer wanted to store the decimal value of `-10` as two's complement using 8-bits of data; we would first take the binary representation of decimal `10`, which would be `00001010`. Then we invert the bits ([one's complement](https://en.wikipedia.org/wiki/Ones%27_complement)) so the binary value becomes `11110101`. Finally, we simply add `1` to the this value, resulting in `11110110`, which is the two's complement for the decimal value `-10`.

It is very helpful to note that in 8-bit binary values using two's complement, the largest possible value is not `255`, which you would normally expect from `11111111`, but it is instead `127`, represented by `01111111`. This is because the first bit is the `sign`, telling us whether the value is positive or negative. Similarly, this means that the smallest possible value is `-127`, resulting from `11111111` where we take the first bit as the `sign`[^12].

Therefore, we can extrapolate that given an 8-bit `exponent`, the \\(emax\\) would be `127` and \\(emin\\) would be `-126`. If you are wondering why the \\(emin\\) value is not `-127`, it is simply because the IEEE standard specifies that \\(emin\\) shall be \\(1-emax\\) for all formats. Meaning `1-127` results in \\(emin\\) being `-126`.

Since the unsigned binary `exponent` in our floating-point calculation is not stored as two's complement, we need to account for the `bias` (or offset). This is a very simple calculation, where the `bias` is denoted by \\(k\\) and uses this formula[^13]:

\\(k = 2^{n-1}-1\\)

Where \\(n\\) in this case is the number of bits in our `biased exponent`. Substituting in the value of \\(n\\) from our previous example; `8`, this gives us the following results:

\\(k = 2^{8-1}-1\\)

This results in `127`, which we already know is the \\(emax\\) value for 8-bit `exponents`. Therefore, to adjust for the `bias`, we simply subtract this value from our original calculation for \\(e\\); `129 - 127` and we find that our adjusted `exponent` \\(e\\) , is `2`. With the `exponent` properly adjusted, we can now add this value to our formula, as follows:

\\(1 × 2^2 × M\\)

Interestingly, since we already know the number \\(n\\) of bits in the `exponent` \\(e\\) between single, double and quadruple precision values, we can pre-calculate their `bias` by using the formula for \\(k\\) above:

|     | SINGLE | DOUBLE | QUADRUPLE |
| - | :-: | :-: | :-: |
| **EXPONENT BITS** | 8 | 11 | 15 |
| **BIAS FORMULA** | \\(2^{8-1}-1\\) | \\(2^{11-1}-1\\) | \\(2^{15-1}-1\\) |
| **BIAS VALUE (\\(emax\\))** | 127 | 1023 | 16383 |
| **BIAS VALUE (\\(emin\\))** | -126 | -1022 | -16382 |

Now that we have interpreted the \\(s\\) (`sign`) and the \\(e\\) (`exponent`) values, it is time to move onto the final piece of the puzzle; the \\(M\\) (`significand`).

### Significand (Mantissa)

Put simply; the `significand` is the part of the floating-point value which contains its significant digits. You may recall that the number of significant digits in the `significand` correlates to the level of precision we are working with. In our example floating-point conversion, we are dealing with a 32-bit single precision value, which gives us a 23-bit `signficand`. The binary value for \\(M\\) in our calculation was found to be:

- `01100000000000000000000`

The next step is to convert this value into a floating-point `significand` to then be substituted into our formula. To do this, we need to account for the 'hidden bit' we mentioned earlier. When dealing with normal numbers, there is a leading `1` which is added to the `significand`, which is *implied* under normal circumstances. The reason this `1` is added is due to the way the `normalization` process works, as we mentioned before when discussing scientific notation; the most significant digit **cannot** be zero. Thus, since we are working with a binary value, if the value cannot be `0`, it must instead be `1`[^14].

Therefore, if we add our implied bit to our example `significand`, we get the following value:

- `1.01100000000000000000000`

It is worth noting at this stage, that we can omit the trailing zeros from the `significand`, leaving us with `1.011`. Substituting this value into our formula (and re-arranging it a bit), we will form the following:

\\(1.011 × 2^2\\)

Note how we have also omitted the `sign` value as it simply determines whether our resulting value is positive or negative, and we already know this value will be positive. The above may look familiar to a value in scientific notation, meaning we can extrapolate the full value by expanding the formula to give us the following:

- `101.1`

Now it is a simple case of converting this value to its final decimal equivalent. Again, the mathematics behind this is very simple; we simply perform \\(2^x\\) where \\(x\\) is a set bit value. The following illustrates this in action:

```plaintext
BIT VALUE: | 2 | 1 | 0 | . | -1 |
BINARY:    | 1 | 0 | 1 | . |  1 |
```

As you can see, only the bit values `2`, `0` and `-1` are set. Hence the final calculation we perform is the following:

\\(2^2 + 2^0 + 2^{-1} = 4 + 1 + 0.5\\)

This results in our floating-point value of `5.5`, which is correct to what we set in the original `C` program. However, this is not the end of the discussion about the `significand`, as we have certain exceptions to deal with, such as 'subnormal' values.

### Subnormal Values

As we laid out in the `significand`, the 'hidden bit' is added to the mantissa when we are dealing with normal numbers. In this case, a normal number is defined as any value where the `exponent` \\(e\\) is greater than `-126`, but less than `128`:

\\(-126<e<128\\)

However, what happens when our `biased exponent` is `0`? Such an event occurs when all the bits in the `exponent` are `0`, meaning when we adjust for the `bias`, the resulting value for \\(e\\) will be `-127`, which falls outside of our defined \\(emin\\) number for single precision values[^15]. According to the IEEE 754 standard, when \\(e=0\\) and \\(M \ne 0\\) , then the value is 'subnormal' and needs a slightly different calculation. In such instances, the formula we would use is as follows:

\\((-1)^{s} × 2^{emin} × M\\)

Essentially, the 'hidden bit' becomes `0` when dealing with subnormal values. For instance, the hexadecimal value `0x007fffff`, when converted into a single precision floating-point value, represents the largest subnormal number possible for this precision level. Breaking this hexadecimal string down into binary format to extract the `sign`, `exponent` and `significand` illustrates this:

```plaintext
BIT NO.:	|  31  | 30                   23  | 22                                                                 0 |
BINARY:		|   0  |  0  0  0  0  0  0  0  0  |  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1  1 |
PARAMETER:	| Sign |         Exponent         |                                Significand                           |
```

As you can see; the `sign` is `0` so we know the final value will be positive. The `biased exponent` is `0`, so adjusting this, we get `-127` for our `exponent`, telling us that the number is subnormal. The `significand` is then prepended with a `0` since the value is subnormal, which then gives us the following:

- `0.11111111111111111111111`

Converting this value into decimal is actually very simple given the fact that every bit is `1`. Since we know there are twenty-three bits in the fractional part of the `significand`, we can simply perform the following calculation to figure out the value of \\(M\\):

\\(1 - 2^{-23}\\)

In this case, this is the same as performing \\(2^{-1} + 2^{-2}+ ... +2^{-23}\\) and results in the value `0.99999988079071`. Now we simply substitute in our values into the equation for subnormal numbers:

\\((-1)^{0} × 2^{-126} × 0.99999988079071\\)

Rearranging this slightly and we end up with:

\\(0.99999988079071 × 2^{-126}\\)

Note that in this equation, our `exponent` value is \\(emin\\) . This results in the largest possible subnormal value of \\(1.17549421069244 × 10^{-38}\\) , which is still a very small number regardless. For reference; the hexadecimal string `0x00000001` will result in the smallest possible subnormal single precision floating-point value.

Now we have learned how to appropriately deal with subnormal values, there are a few other exceptions that you will need to be aware of when converting hexadecimal strings into floating-point numbers.

### Signed Zero

While testing out IEEE 754 floating-point conversions, you may attempt to calculate the floating-point value of a hexadecimal string consisting of all zeroes, such as `0x00000000`. This is interesting, because you may be able to look at this and immediately realise that the resulting floating-point value must also be `0`. However, how can you ascertain whether it is positive or negative?

Ordinarily, the number `0` does not have a sign, but when dealing with IEEE 754 floating point values, this is not the case, and we can obtain the result of a [signed zero](https://en.wikipedia.org/wiki/Signed_zero). In terms of the floating-point arithmetic we have laid out thus far, a signed zero will occur when the `exponent` \\(e\\) and `significand` \\(M\\) values are all zeroes. The only difference between a positive and negative zero is dependant on the value of the `sign` \\(s\\).

Therefore, we can say that there are two further special exceptions in the floating-point arithmetic which occur when \\(e\\) and \\(M\\) are all zeroes. A positive zero can be obtained by converting the hexadecimal string `0x00000000` into a single precision floating-point value, and a negative zero can be obtained from the hexadecimal string `0x80000000`. The reason this particular string results in a negative zero is very easy to notice when written in binary format:

- `1000 0000 0000 0000 0000 0000 0000 0000`

As you can see, the `sign` \\(s\\) value is `1`, which immediately informs us that the resulting value will be negative, as per \\((-1)^1\\) . Since the rest of the binary value are zeroes, we can simply say that the resulting floating-point number is `-0`[^16].

### Signed Infinity

Another special quantity which can arise from IEEE 754 floating-point calculations is either positive or negative infinity. Looking through the logic we have demonstrated so far, you may have noticed that we ended up with a subnormal value when the adjusted `exponent` \\(e\\) was `-126`. However, what happens when the value of \\(e\\) is on the other end of the spectrum at `128`?

This event occurs when all of the bits in the `exponent` are `1`, meaning when we calculate the `biased exponent`, it will be `255` (for single precision numbers). Adjusting this value to account for the `bias`, we end up with `128` as the value for \\(e\\) , which falls outside of our defined range for normal and subnormal numbers[^17].

It should be noted in this case that the term 'inifinity' is used to refer to floating-point values which would otherwise cause an overflow. In the context of binary floating-point computation; an 'overflow' pertains to the problems computers will encounter when representing very large numbers. Similarly, the term 'underflow' is used to describe the issue of computers representing very small numbers.

Therefore, the IEEE 754 standard accounts for this and specifies that when the value of \\(e\\) is \\(emax + 1\\) and the `significand` \\(M\\) is all `0`, then the result will be INF (infinity). As seen before with signed zero, the infinity result can also be either positive or negative, depending on the value of the `sign` \\(s\\) bit.

According to these rules, in terms of single precision floating-point values; the hexadecimal string `0x7f80000` will result in positive infinity (+INF), while the hexadecimal string `0xff800000` will result in negative infinity (-INF).

### NaN (Non-Numbers)

The final special quantity which can arise from IEEE 754 floating-point calculations is [NaN](https://en.wikipedia.org/wiki/NaN), or Not-a-Number (commonly referred to as Non-Numbers). NaNs occur in floating-point values when the `exponent` \\(e\\) is \\(emax +1\\) , similar to the aforementioned signed infinity values. However, this time the difference being that the `significand` \\(M\\) is non-zero[^18].

A non-number simply refers to an invalid computational mathematical operation, the most famous example being the division of any number by `0`. Another example is attempting to perform the square root of a negative number. In the case of floating-point values, the non-zero `significand` separates NaNs from signed infinity and becomes an impossible mathematical operation because you cannot use infinity in arithmetic.

Thus, the IEEE 754 standard specifies that in cases where the `exponent` \\(e\\) value is \\(emax + 1\\) and the value of the `significant` \\(M\\) is non-zero; the resulting floating-point number will be considered NaN.

Interestingly, it is worth noting that unlike the signed zero and signed infinity exceptions, the `sign` \\(s\\) bit in the computation of Non-Numbers makes no difference. In other words; there is no distinction between positive NaN or negative NaN. Therefore, we can say, for example; the hexadecimal string `0xffc00001` will result in a NaN. This is much easier to ascertain by examining this string in binary form:

- `1 11111111 10000000000000000000001`

### Addressing the Observation

My original observation formed the basis for the aforementioned research into how binary floating-point numbers are interpreted by computers using the IEEE 754 standard. In my case, I wanted to understand how the hexadecimal value `0x40091eb851eb851f`, stored in the `xmm0` register, converts into the floating-point number `3.14`, as written in the `C` source code.

Although much of my research focused on single precision values, the logic is very easy to adjust for double precision values. In this case, since the hexadecimal string `0x40091eb851eb851f` is 64-bits long, it will result in a double precision floating point number. Firstly, I will convert this string into binary to then extract the `sign`, `exponent` and `significand`:

- `0100000000001001000111101011100001010001111010111000010100011111`

In the case of double precision values, the `exponent` \\(e\\) consists of `11` bits (with a `bias` of `1023`) and the `significand` \\(M\\) consists of `52` bits, as follows:

```plaintext
SIGN:               0 (Number is positive)
BIASED EXPONENT:    10000000000 (Decimal: 1024)
ADJUSTED EXPONENT:  1024 - 1023 = 1
MANTISSA:           1001000111101011100001010001111010111000010100011111
```

By breaking down the binary into these parts, we can quickly ascertain whether we are dealing with a subnormal or other special quantity. In this case, we have a normal number, so no exceptional calculations need to factor into our conversion. If you will recall, the formula for the conversion that we will use for normal numbers is as follows:

\\((-1)^{s} × 2^{e-bias} × M\\)

We already know \\(s\\) is `0` so the result will be positive. The adjusted `biased exponent` \\(e\\) is `1` and the `significand` \\(M\\) will be `1.1001000111101011100001010001111010111000010100011111`. To adjust the `singificand`, we use the arithmetic we outlined earlier, which will give us a final \\(M\\) value of:

- `1.57000000000000006217`

Now we can substitute these values into the formula, providing us with our final calculation in scientific notation, as follows:

\\(1.57000000000000006217 × 2^{1}\\)

Which results in our double precision floating-point value of `3.14`. Therefore, I have been able to successfully apply the arithmetic outlined in the IEEE 754 standard to convert a 64-bit hexadecimal value into a floating-point number, which I was previously unable to do within the disassembly tool.

The next step I decided to take was to create a shell script, written entirely using `BASH` logic, and no reliance on external tools, with the goal of converting hexadecimal strings to floating-point values straight from the Linux command-line. After carefully reviewing my research up to this point, I was confident I could write a functioning `BASH` script, so I formulated a hypothesis.

## Hypothesis

I will admit that `BASH` is a very limiting 'language' to script in, and although I would prefer to use something like `C`, I could see that such conversion programs had already been written, whereas I could not find any examples of `BASH` scripts which handled floating-point conversions. Normally, I would be under the assumption that if someone has not done it before me, then it is likely impossible, or rather, impractical to do so.

Nevertheless, my research supports the idea that such conversions are possible using `BASH`, therefore, I posed my hypothesis; *It is possible to reliably convert hexadecimal strings to precision-appropriate floating-point values using BASH script*. The next step, as with all (good) hypotheses, was to perform testing and experimentation to either prove or disprove my hypothesis.

## Experimentation / Testing

### Environment

Development and testing of this shell script was performed solely on a Linux machine running the [Fedora](https://getfedora.org/) 32 distribution. It is also important to note that, due to having to factor rounding into certain `BASH` calculations, I was running `BASH` version 5.0.17. Finally, this machine uses an Intel-based processor, which is also significant as different processors, such as ARM, may use different levels of precision in floating-point calculations.

### Conversions

When I write a shell script, or any program, I typically write small portions of the code, verify that code is working as intended, and then expand upon it as needed. In this case, I knew that I would need to convert the hexadecimal input string to binary to perform the floating-point calculations, so I decided to add simple binary conversion functionality to the script at the same time.

I wanted to avoid using external Linux tools like `bc` to do the arithmetic, so I decided to simply map each possible hexadecimal character to its corresponding binary value in a `case` statement, which worked perfectly. This method would also eliminate the issue of leading zeroes being removed from the output, which is a problem with tools like `bc`.

Just because I could, and to make the script a bit more useful, I also added conversions from hexadecimal to ASCII and decimal formats. Again, this was very straightforward to do with `BASH` logic. For conversion into ASCII, I simply used a one-line `for` loop, as follows:

```shell
for char in $(echo "$hex_string" | sed "s/\(..\)/\1 /g" | tr -d '\x00'); do printf `echo "\x$char"`;done
```

This loop iterates through each hexadecimal character, and uses `printf` to display the character in ASCII format. It should be noted that during testing I had issues with NULL bytes, so I ended up having to use `tr` to trim them from the input. It was at this point I also implemented rigorous user input sanitisation for all functions, to prevent incorrect strings from being treated as hexadecimal.

Conversion from hexadecimal (base-16) into decimal (base-10) was even easier using the following one-liner:

```shell
echo -n "$hex_string" | sed 's|0x||g' | sed 's| ||g' | sed 's|^|0x|' | xargs printf "%f\n" | sed 's|\..*||g'
```

As with the ASCII conversion, this simply uses `printf` in conjunction with `xargs` to display the hexadecimal input string in decimal format.

### Floating-Point Functions

Writing the functions covering the extraction of the `sign`, `biased exponent` and `significand` from the hexadecimal input string were a bit more challenging. Firstly, I would convert the input into binary and then use an `if` statement to check how long the input string was. I decided to write functions covering conversions from an input value of 16-bits (Half precision), 32-bits (single precision), 64-bits (double precision) and 128-bits (quadruple precision).

Starting with single precision values, I used `awk` to separate the binary string into the `sign`, `exponent` and `significand`. I then wrote a variable to adjust the decimal `exponent` value based on the `bias` for the precision level I was working at (e.g. 127 for single precision). Dealing with the `significand` took a little more tweaking, since there is no method (that I know of) in `BASH` to convert a binary string with a decimal point into a base-10 number.

Therefore, I came up with the idea to initialise the mantissa as an array and then iterate through each bit, mapped to another numbered array, using a `for` loop and an `awk` calculation to perform \\(2^x\\) where \\(x\\) is every bit equal to `1`. This sounds more complicated than it actually is, but then all I had to do from here was add the resulting values together and I get my decimal value for \\(M\\) .

Substituting these values into the formula for floating-point calculations was simple using a command in `gawk`. For instance, the `gawk` command I used for the final calculation for double precision normal floating-point numbers was as follows:

```shell
gawk -M -v ROUNDMODE="Z" '{print (-1)**'$sign'*2**('$biased_exponent'-1023)*(1+'$significand')}'
```

Here, you can see that I adjust the `biased exponent` by subtracting `1023` from the value, as per the double precision value in this case. Since this is a normal number, `1` is added to the `significand` to account for the 'hidden bit'. You will note that I had to use `gawk` so I could take advantage of the `-M` parameter, which performs all integer arithmetic using [GMP](https://gmplib.org/) arbitrary-precision integers. The `ROUNDMODE` variable passed to `gawk` changes the rounding mode to use for arbitrary precision arithmetic on numbers.

When it came to dealing with subnormal numbers, I used an `if` statement to check the \\(e\\) and \\(M\\) values to ensure they matched the criteria for subnormals. Then I could substitute the values into the following calculation (double precision in this case):

```shell
gawk -M -v ROUNDMODE="Z" '{print (-1)**'$sign'*2**(-1022)*'$significand'}'
```

The difference here is that there is no need to specify the `exponent` as a variable. For subnormals, the value of \\(e\\) will be equal to \\(emin\\), which in this case would always be `-1022` for double precision floating-point values. Finally, the only other difference is that the `significand` is left as is, with the 'hidden bit' at `0`.

The last issues I had to account for were the exceptions for the special quantities; signed zero, signed infinity and NaN. Again, this was very easy to implement as multiple `if` statements to check (and compare) the values of the `sign`, `exponent` and `significand` to understand how to treat the output value. For instance, should the value of \\(e\\) be `0`, \\(M\\) be non-zero and \\(s\\) be `1` then the result would be negative zero.

Unfortunately, one of the issues I ran into when testing this script early on was with the rounding of very small numbers. For instance, when I supplied a hexadecimal input string such as `0x00800000`, which would normally convert into the smallest possible normal number of \\(1.1754943508 × 10^{−38}\\) , it would instead output `0.0000000000000000000000000000`. I eventually realised that this was an issue with the rounding which I could not accurately account for. Hence why I had to use `gawk` as outlined earlier.

## Data Analysis

Once the bulk of the `BASH` script functionality was written and tested, I could start analysing the results. For my control variables, I took the hexadecimal input values which covered each of the following:

- Normal Numbers
- Subnormal Numbers
- Signed Zero
- Signed Infinity
- Non-Numbers (NaN)

I then fed these input values into each of the four functions I had created for IEEE 754 binary floating-point conversions; half, single, double and quadruple precision. Each one I tested yielded the correct floating-point value with no obvious errors in my experimentation. With this said, I decided that the final test would be my original floating-point `C` program variables I specified at the beginning of this article. As a reminder; in this program I used a single precision value of `5.5`, and a double precision value of `3.14`.

When I disassembled this program using `r2`, I found that the hexadecimal value of the single precision floating-point number was `0x40b00000`. Using my script, which I named `HexConv` (very original I know), with the `-fs` parameter, resulted in the following:

```shell
$  ./hexconv -fs 40b00000
SIGN (S):				0
EXPONENT (E):				10000001 (Dec. 129)
MANTISSA (M):				01100000000000000000000
EXPONENT BIAS ADJUST:			2

SINGLE-PRECISION FLOATING NUMBER:	5.5000000000000000000000000000
```

As you can see, the converted floating-point value was `5.5`, with a few trailing zeros, which is a symptom of the rounding problem I had to circumvent. Lastly, I also tested the double precision value, whose hexadecimal string was found in `r2` to be `0x40091eb851eb851f`. Again, my `HexConv` script yielded the following results:

```shell
$  ./hexconv -fd 40091eb851eb851f
SIGN (S):				0
EXPONENT (E):				10000000000 (Dec. 1024)
MANTISSA (M):				1001000111101011100001010001111010111000010100011111
EXPONENT BIAS ADJUST:			1

DOUBLE-PRECISION FLOATING NUMBER:	3.1399999879323230445038461766671389341354370117187500
```

You may be wondering why the resulting floating-point value is not exactly `3.14`, well this is again due to the fact I specify a much higher level of precision in my script calculations to account for the rounding problems. However, this value is still functionally `3.14`.

## Concluding Statements

Satisfied with the results that my `HexConv` script were producing, I published the script on my [GitHub](https://github.com/TMairi) page, and the script itself can be found [here](https://github.com/TMairi/HexConv/blob/master/hexconv). As I stated previously, I am aware that converting hexadecimal strings to IEEE 754 floating-point values using `BASH` may not be the most efficient nor the most practical method of doing so. However, I figured that scripting the arithmetic outlined in my research using `BASH` would give me a much greater understanding of the fascinating mathematics involved in these conversions. Additionally, since I could not find any working examples of shell scripts which performed IEEE 754 conversions, I figured it would also be a decent test of my `BASH` knowledge, since I had nothing to compare it to.

Interestingly, this topic of research was sparked by my interest in learning more about the `r2` disassembly framework. On this topic, I will say that I am very much enjoying using `r2` as I find its syntax very easy to understand and is a fantastic tool for someone like me, who likes to work primarily on the command-line. Although this article was not an in-depth look into `r2` or reverse engineering in general, once I have experimented more with disassembly using `r2`, I will likely publish any interesting findings here, which will be more technical than mathematical.

Finally, I would like to conclude this article by stating that; understanding the arithmetic behind how computers interpret strings as floating-point values can be exceptionally useful for people working in the cyber industry. I know from experience that a lot of my junior colleagues would be resistant to learning assembly or computational mathematics. I understand that these can be daunting or even boring subjects, but I always find that those who frequently ask *"why?"*, will invariably become better analysts.

Indeed, as with everything in science and especially in cyber, you should always strive to understand *why* something works. In the context of this article, that 'something' for me was the IEEE 754 arithmetic, and as mathematics is the language of science, I was captivated to take the time to learn how it worked.

If you have any recommendations or questions about the topics mentioned in this article, you can contact me on [Twitter](https://twitter.com/AstrumMairi).

-- Mairi

## References

[^1]: LibreTexts. (2021). [Significant Figures - Writing Numbers to Reflect Precision](https://chem.libretexts.org/@go/page/47448) [Accessed: 2021-05-08]
[^2]: CODATA. (2018). [CODATA Value: proton mass](https://physics.nist.gov/cgi-bin/cuu/Value?mp) [Accessed: 2021-05-08]
[^3]: Harries, I. (2004). [Floating Point Numbers](https://www.doc.ic.ac.uk/~eedwards/compsys/float/) [Accessed: 2021-05-08]
[^4]: CODATA. (2018). [CODATA Value: speed of light in vacuum](https://physics.nist.gov/cgi-bin/cuu/Value?c) [Accessed: 2021-05-08]
[^5]: Lower, S. (2021). [Significant Figures and Rounding](https://chem.libretexts.org/Bookshelves/General_Chemistry/Book%3A_Chem1_%28Lower%29/04%3A_The_Basics_of_Chemistry/4.06%3A_Significant_Figures_and_Rounding) [Accessed: 2021-05-08]
[^6]: IEEE. (2019). [IEEE 754-2019 - IEEE Standard for Floating-Point Arithmetic](https://standards.ieee.org/standard/754-2019.html) [Accessed: 2021-05-08]
[^7]: Goldberg, D. (1991). [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) [Accessed: 2021-05-08]
[^8]: StackOverflow. (2012). [Hex to Binary conversion in bash](https://stackoverflow.com/questions/11120324/hex-to-binary-conversion-in-bash) [Accessed: 2021-05-08]
[^9]: Finley, T. (2000). [Floating Point](https://www.cs.cornell.edu/~tomf/notes/cps104/floating.html) [Accessed: 2021-05-08]
[^10]: Irvine, R. K. (2000). [Tutorial: Floating-Point Binary](https://cstl-csm.semo.edu/xzhang/Class%20Folder/CS280/Workbook_HTML/FLOATING_tut.htm) [Accessed: 2021-05-08]
[^11]: Finley, T. (2000). [Two's Complement](https://www.cs.cornell.edu/~tomf/notes/cps104/twoscomp.html) [Accessed: 2021-05-08]
[^12]: Chadwick, R. (2021). [Binary Negative Numbers!](https://ryanstutorials.net/binary-tutorial/binary-negative-numbers.php) [Accessed: 2021-05-08]
[^13]: Koretskyi, M. (2016). [The mechanics behind exponent bias in floating point](https://indepth.dev/posts/1018/the-mechanics-behind-exponent-bias-in-floating-point) [Accessed: 2021-05-08]
[^14]: Oracle. (2000). [IEEE Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_math.html) [Accessed: 2021-05-09]
[^15]: IBM. (2019). [Subnormal numbers and underflow](https://www.ibm.com/docs/en/i/7.4?topic=numbers-subnormal-underflow) [Accessed: 2021-05-09]
[^16]: Stan Development Project. (2019). [Floating-point representations](https://mc-stan.org/docs/2_26/stan-users-guide/floating-point-representations.html) [Accessed: 2021-05-09]
[^17]: Harries, I. (2003). [Infinity and NaNs](https://www.doc.ic.ac.uk/~eedwards/compsys/float/nan.html) [Accessed: 2021-05-09]
[^18]: Lawlor, O. (2011). [Weird Floating-Point Numbers: Infinity, Denormal, and NaN](https://www.cs.uaf.edu/2011/fall/cs301/lecture/11_09_weird_floats.html) [Accessed: 2021-05-09]
