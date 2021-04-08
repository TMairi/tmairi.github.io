---
title: Forensic BASH Scripting: LNK Parsing
author: Mairi
date: 2021-04-08 20:56:00 +0100
categories: [DFIR, BASH, Linux]
tags: [dfir, bash, linux, scripting]
comments: false
---
Forensic `BASH` script: [lnkparser](https://github.com/TMairi/lnkparser/blob/master/lnkparser)

## Observation

Recently, while probing a Windows image file in my spare time, I came across a plethora of user-generated Windows shortcut files, also known as LNK files as denoted by their extension `.lnk`. A quick look into the hexadecimal output of one of these LNK files showed that there was a lot of valuable information which could be extracted. Therefore, I went searching for a parsing tool which could pull this data for me.

However, being a Linux user, I found that most of the parsers available online, such as Eric Zimmerman's [LECmd](https://ericzimmerman.github.io/#!index.md) program, were PE (Portable Executable) files for use on Windows machines. Therefore, I began my research into how feasible it would be to create a script, written completely in `BASH` (shell), to parse out the contents of the LNK files.

One of the primary design goals of this hypothetical shell script was to rely solely on typical Linux tools which come as standard on any mainstream distribution, such as; `xxd` (for reading hexadecimal data), `sed`/`awk` (for transforming the output data for better parsing) and `printf` (for feeding the data back to the end-user). I purposefully avoided making the script dependant on external tools such as `bc`, so it would *hopefully* be able to work on most Linux distributions without issues.

## Research

This article will not provide an in-depth look into the forensic relevance of LNK files, nor their use in an investigation, as this topic has already been covered many times by various articles; [1](https://www.magnetforensics.com/blog/forensic-analysis-of-lnk-files/), [2](https://forensicswiki.xyz/wiki/index.php?title=LNK), [3](https://www.forensicfocus.com/articles/evidentiary-value-of-link-files/). This article is purely to document how my LNK parsing script works and the devlopment process I went through while writing the code.

As with every task or problem I am faced with, I use the [scientific method](https://en.wikipedia.org/wiki/Scientific_method) to help me structure a plan of action. As we can extrapolate from my earlier comments, I already have my question; *"Is it possible to reliably parse out useful data from LNK files using only shell script?"*. Hence, the next step (my favourite part), is to conduct research, which I split into three phases:

1.  Understand the LNK data structures and what data they contain
2.  Understand the potential limitations of `BASH` in relation to parsing the data structures
3.  Obtain multiple, valid LNK files with varying data for the experimentation and testing phase

To better understand the data structures comprising an LNK file, I turned to the official documentation supplied by Microsoft and found that the 'Shell Link Binary File' (LNK) format was detailed [here](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-shllink/99e8d0e5-5bc6-4aed-af37-da7f584f832a). I will not explain in-depth what these structures are, or what data they provide, as this has already been explained in the aforementioned documentation, as well as other forensic articles online, e.g.; [Exploring Windows Artifacts: LNK Files](https://u0041.co/blog/post/4). The official documentation also provides an [example](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-shllink/4d25bbad-09b7-4322-8c0a-521d268481bb) break-down of a given LNK file, which proved to be a very useful reference guide for some of the structures.

### Link Flag Parsing

Looking at the data structures, it seemed that their offset values are relatively straightforward. In the first structure, the **SHELL\_LINK\_HEADER**, I noted that the 4 byte `LinkFlags` structure (Offset `0x0014`) would be the first challenge to parse using only Linux `BASH` commands due to the various bit values which can be set. After writing some pseudo-code, I figured I could get this to work by creating two arrays; one containing the flag value as specified in the documentation, and the other containing the binary value (`1` or `0`) of said flag. These two arrays would then be compared via a 'for loop' and the script would output any flag whose binary value equals `1` (i.e. that flag is 'set').

### FILETIME Timestamps

Interestingly, I also used a similar array comparison method to achieve the same results for the target file attribute data, also stored in the header structure. The next challenge from this structure was the timestamps, which required a conversion from `FILETIME` format to `Unix` time, to then be decoded with the following command:

> `date -d@<UNIX_TIME>`

As a result of my research, converting the timestamps was relatively easy to implement in shell script:

1.  Calculate the difference between the epochs (`FILETIME`: 1601-01-01 -> `Unix`: 1970-01-01) in seconds
2.  Read the 8-byte hexadecimal `FILETIME` timestamp value in little-endian format
3.  Convert this hexadecimal value to decimal
4.  Divide the decimal value by 10000000 and then minus the epoch difference to get the `Unix` timestamp
5.  Decode the `Unix` timestamp using the `date` command

### Shell Items

The next structure I found challenging to deal with was the **IDList**. During the research phase, I found that this structure could potentially contain shell items, which are notably undocumented by Microsoft. However, I did come across a very helpful [repository](https://github.com/libyal/libfwsi/blob/main/documentation/Windows%20Shell%20Item%20format.asciidoc) which outlines a data format specification for these shell items. Of these undocumented shell items, I was most interested in parsing out the Operating System version information and MFT INDEX values where available.

### FAT Timestamps

However, within these Shell Items, I came across another potential issue stemming from the limitations of `BASH`; the Creation and Access timestamps in the shell items are in `MS-DOS` (FAT) format. Fortunately, this format is [documented](https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-dosdatetimetofiletime?redirectedfrom=MSDN) by Microsoft, wherein I discovered that the 4 byte timestamp values are simply a binary bitmask. Therefore, in `BASH`, all I had to do was parse out the 32-bit binary string for the given timestamp, separate the values according to their bitmask, convert each value to decimal and then append them together to form a readable timestamp.

### File Path Parsing

Following this, the other structure I anticipated `BASH`-related problems with was **LINK_INFO**, specifically when dealing with the target file path (`LocalBasePath`). The reason I foresaw issues here is that the target file name could consist of many characters (especially on NTFS file systems) and there was no data within the LNK file to specify exactly how long this path. However, there was the `LocalBasePathOffset` within the **LINK_INFO** structure which would tell me where in the LNK file the file path began. Therefore, I figured I could calculate the length of the `LocalBasePath` by reading the data starting from the offset value, until it hit the NULL-terminated string called the `CommonPathSuffix`. Thus the data read between the offset and the NULL string would comprise the full target file path, which could then be converted into ASCII.

### Extracting LNK Files

With the LNK data structures and the potential issues I may encounter within `BASH` solved, I then looked to acquiring some valid LNK files I could use for testing the script as it was being developed. Luckily, I had access to Windows image files ranging from XP to 10, from which I could extract a rather modest sample size from. To bulk-extract these files from a given Windows image, I simply used the following `sleuthkit` commands:

> `mmls image.raw`
> 
> `fls -o 63 -Fru image.raw > all.files`
> 
> `grep "\.lnk$" all.files | grep Recent | sed -n 's|^.* \(.*\):.*|\1|p' | sed -n 's|^\(.*\)-.*-.*|\1|p' > inodes`
> 
> `for inode in $(cat inodes); do icat -o 63 image.raw $inode > $i.lnk; done`

From the above commands, I use `mmls` to determine the starting sector offset value of the primary NTFS partition to query (`63`). Then I used `fls` to list all files `-F`, recursively looking in all directories `-r`, only for allocated (undeleted) files `-u`, and output the list to a file named `all.files`. I then used a combination of `grep` and `sed` to look for potentially user-created (Recent) LNK files, only display their corresponding MFT entry (inode) value and write the list to a file (`inodes`). Then simply use a `for` loop in combination with `icat` to iterate through these inode values and extract them. Once this process was repeated for multiple image files, I had over 200 LNK files ready to be tested.

## Hypothesis

Once I had completed my research and gathered my samples, I then posed my hypothesis; *It is possible to extract the contents of LNK files using only standard Linux tools*. With this, I began testing my hypothesis through developing the `BASH` script. The experimentation process was conducted on the sample files each time functionality was added to the main script.

## Experimentation / Testing

For example, the first parser I wrote was a simple check to ensure that the LNK file header was correct; `0x0000004C`, in addition to the CLSID value; `00021401-0000-0000-C000-000000000046`. I used this as a control variable of sorts to ensure that my basic `xxd` parsers would work on the sample files. Using a `for` loop to run the header check against all of my LNK files, in addition to some known 'negative' (non-LNK) files proved that it worked.

In some cases, I would encounter errors when analysing the results of the experiment, whereby a parser may work for one LNK file as intended, but not another. Often this was simply attributed to a coding oversight or incorrect handling of the data structure, which could be remediated without issue.

I also encountered a problem when adding output functionality to the script, as I wanted the user to be able to write the contents of `STDOUT` to a CSV file for compatibility reasons. I wound up having to write the contents of the parser to a temporary file each time it was executed and remove this file each time unless the user explicitly uses the output `-o` argument. This is not an ideal solution by any means, but it works given the design limitations of the script.

## Data Analysis

Once the primary functionality of the script was written and fully tested, I could review the results. Most importantly; the script works well and does not rely on external tools or libraries to parse out the LNK data structures. Every LNK sample file I had was tested and barring a few sparse files, each one produced data which could prove very useful for a forensic examiner. However, there were a few issues during the analysis phase I noticed:

1.  The script does not handle unicode characters well

Only a small handful of the files tested appeared to contain unicode characters in the file paths, which caused an issue with the parsers combining data sets. This is not a major issue as the data is still readable, just not in a very nice format. This would need more testing with LNK files before I can definitively fix the issue.

2.  The script does not parse out Network Share data

Unfortunately, none of the samples I had to hand contained Network Share data under the `CommonNetworkRelativeLink` structure. Therefore, no parsers for this data have been written as I would not have been able to test them properly. Again, this requires more sample files, preferably with valid structures containing data in this particular structure to remedy.

## Conclusion

In conclusion, the script was deemed complete and working as intended and was then released onto my GitHub page, which you can find [here](https://github.com/TMairi/lnkparser). If you have any recommendations or questions about this script, or the development process outline above, you can contact me on [Twitter](https://twitter.com/AstrumMairi).

-- Mairi
