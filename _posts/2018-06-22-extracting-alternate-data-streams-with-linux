---
title: Extracting Alternate Data Streams with Linux
author: Mairi
date: 2018-06-22 01:00:00 +0100
categories: [DFIR, Linux]
tags: [dfir, linux, windows]
comments: false
---

## Foreword

This article will be covering a feature of the NTFS file system known as the Alternate Data Stream (ADS), focusing on how to properly identify and extract these data streams from an NTFS volume using a Linux host.

> **DISCLAIMER**: This article was written by myself and was previously posted on a now-defunct website on 2018-06-22. I backed up the original contents of the article prior to the website shut-down and am now reposting it here for preservation. All information was correct and accurate at the time this article was written.

## Alternate Data Streams

Despite being talked about fairly regularly in the forensic community, Alternate Data Streams (ADS) are not a well-known feature of the NTFS file system, nor are they officially well-documented. ADS was first implemented into Windows NT 3.1 to allow compatibility with the Hierarchical File System (HFS), designed for Macintosh systems at the time. The reason for this was tied into how HFS stores data using two main components; a `data` fork and a `resource` fork. On HFS, the data fork comprised the actual data and the resource fork was used by the host Operating System to interpret the data. This functionality is analogous to file extensions on Windows systems[^1]. 

The Alternate Data Stream on the Windows NTFS file system was designed to play the part of the resource fork for HFS; providing Windows with a way to interpret the data on HFS volumes. Bear in mind that all files in NTFS consist of at least one visible data stream, usually referred to as the MFT attribute `$DATA` or the ‘unnamed data stream’[^2]. 

An ADS is simply another data stream attached to a given file which is hidden from the user and even programs such as Windows Explorer. Some files on Windows systems will commonly incorporate multiple data streams, such as for the purpose of holding metadata. For example; a Microsoft Word document will often contain metadata (author, word count, page number, etc.) that is attached to the document via an ADS. When understanding ADS, it is easier to think of them as hidden files that are ‘attached’ to visible ones.

### Abusing Alternate Data Streams

The ability to add another data stream to any file on NTFS, which is not only hidden from the user but difficult for security programs to detect, carries a high potential for abuse. Penetration testers sometimes use ADS to bypass expected behaviour in applications which do not account for input including an Alternate Data Stream. A historical vulnerability involving the abuse of ADS was seen in [CVE-1999-0278](https://nvd.nist.gov/vuln/detail/CVE-1999-0278), wherein attackers using Internet Information Services (IIS) could obtain source code for ASP files simply by appending the string `::$DATA` to the URL.

Alternate Data Streams on NTFS also exhibit unique qualities which make them a desirable target for attackers wishing to abuse them[^3]:

* No attributes
* Unreported Size
* No size limitations	
* Multiple streams per file
* Can affect directories and drives
* Difficult to unintentionally access
* Often go undetected by security programs

A common method attackers employ to abuse Alternate Data Streams is to add an executable payload to any file on the NTFS file system, which can then be executed with specific commands, without the users knowledge. Removing a malicious ADS is as simple as deleting the file it is attached to. However, should the ADS be attached to a critical system file such as the root of the file system, this would be much harder to reliably remove.

### Forensic Relevance

From a forensic perspective, NTFS Alternate Data Streams have severe implications for Anti-Forensics, as an attacker could potentially hide multiple incriminating files or malicious payloads through hidden data streams on other files. However, these Alternate Data Streams are not hidden or exempt from forensic analysis programs, as will be demonstrated later. Additionally, there are applications available to forensic examiners that are purposefully designed to detect hidden data streams on an NTFS system, such as[^4]:

* [LADS](https://www.aldeid.com/wiki/LADS)
* [LNS](http://ntsecurity.nu/toolbox/lns/)
* PowerShell
* [Streams](https://docs.microsoft.com/en-us/sysinternals/downloads/streams)

These tools are mostly Windows-based and some of them are required to be executed on a live file system, which may not be considered forensically sound, especially if employed in a live forensic scenario. After researching the role of data streams on NTFS, I was naturally curious as to whether I could detect and forensically extract Alternate Data Streams using Linux. This observation and subsequent research into ADS formed the basis for a hypothesis, from which I conducted an experiment into whether Linux tools have the capability to detect ADS on an NTFS image file. 

## Experimentation

### Assumption and Methodology

The assumption during these tests is that a forensic examiner has obtained a Windows NTFS image file and they want to run commands from a Linux-based host to ensure that nothing is hidden via suspicious data streams. With this in mind, I created a simple methodology for the experiment as follows:

1. Create a Windows 10 Virtual Machine
2. Create some superfluous ADS using the Command Prompt
3. Convert the VMDK image to RAW format
4. Forensically mount the image on Linux
5. Identify ADS using relevant commands
6. Extract any suspicious ADS from the disk image

### Testing

Firstly, I created a clean Windows 10 (Build Version 1803) virtual machine with VMWare Workstation 12 and used a single 40GB disk image file during the installation process. The next step was to create some exemplary Alternate Data Streams using the Windows Command Prompt `cmd.exe`[^5]:
```cmd
echo “First Alternate Data Stream” > test.txt:hidden.txt
type C:\Windows\System32\notepad.exe > important.docx:hidden.exe
```
The first command shown above creates a simple ADS text file `hidden.txt`, the content of which having been redirected from an `echo` command consisting of the string *“First Alternate Data Stream”*. Note that the main data stream `test.txt`, does not need to exist beforehand and the result will be an empty text file with the hidden ADS file attached to it. 

The second command shown above demonstrates how an executable file could be attached as an Alternate Data Stream. In this case, the `type` command (similar to Linux `cat`), is used to display the contents of the default `notepad.exe` program, which is then redirected to an ADS `hidden.exe`, attached to another empty file `important.docx`.
	
Running a `dir` command on the directory containing the superfluous ADS files will only show the contents and basic properties (file size) of the empty files they are attached to, with no indication that Alternate Data Streams exist. However, it should be noted that running `dir /s /r` on the same directory **will** display the hidden data stream.

It is worth pointing out that at this stage of the testing; as long as your Windows system incorporates PowerShell version 3.0 (or later), you can read from and write to Alternate Data Streams using PS commands. You can utilise the `Get-ChildItem` (GCI) PowerShell command to recursively check a directory for Alternate Data Streams[^6]:
```powershell
gci -recurse | % { gi $_.FullName -stream * } | where stream -ne ‘:$Data’
```
The command shown above will recursively list the data streams associated with files in a given directory and through use of the `where` command, will show any data streams other than the default `$DATA`. Should a suspicious ADS be identified using this command, another PowerShell command can be issued to read the data it contains. This command is `Get-Content` and can be utilised as follows[^7]:

```powershell
Get-Content -path C:\Users\Mairi\Documents\ADS_Test\test.txt -stream hidden.txt
```
In the above command; simply supply the `-path` parameter with the original file path and the `-stream` parameter with the name of the ADS as reported by `Get-ChildItem`. In the example used in this test, the content of the ADS was simply the text as created beforehand from the `echo` command.

With the ADS in place, the next step in the experimentation process is to forensically analyse the contents of the virtual machine disk image using a Linux host. Because I want the disk image file to be compatible with commands provided by the Sleuth Kit, the `VMDK` image first needs to be converted to the `RAW` image format. This can be achieved using the `qemu-img` command, typically provided by installing [QEMU](https://pkgs.org/download/qemu) for Linux systems:
```shell
qemu-img convert -O raw <INPUT>.vmdk <OUTPUT>.raw
```
The length of this conversion process will be dependent on how large the input VMDK file is, but should result in the creation of a `RAW` image of the Windows virtual machine which can now be interrogated with Linux forensic tools.

The next step in the testing process is to attach the newly created `RAW` Windows disk image to a loop device, create the relevant partition mappings and then forensically mount the desired partition to a directory. This can be achieved using the following commands:

```shell
mmls image.raw
kpartx -av image.raw
ntfsmount -o ro,streams_interface=windows /dev/mapper/loop0p2 /mnt/Analysis/Windows
```

The partition mapping can be mounted using the normal Linux `mount` command, however I decided to use the NTFS driver for Linux instead because I could more reliably read information from any potential Alternate Data Streams that may be present on the image. The `ntfs-3g` driver can be easily [installed](https://pkgs.org/download/ntfs-3g) on most mainstream distributions of Linux and provides the option to include all of the data streams associated with each file. 

As shown above, the `RAW` disk image is first queried with the `mmls` command incorporated into the Sleuth Kit forensics tool to look at the partition layout of the virtual machine. The `kpartx` tool automatically creates a loop device for the disk image and dynamically adds partition mappings for the detected NTFS volumes. The desired partition is shown to be associated with the block device `/dev/mapper/loop0p2`, as the first mapping is simply Windows System Reserved. The `ntfsmount` command mounts the desired partition to a directory on the Linux system using the NTFS driver.

The `-o` parameter of the `ntfsmount` command specifies two things; mount the partition as read-only `ro` and preserve the ability to read named NTFS data streams `streams_interface=windows`. The last two arguments of this command simply specify the partition mapping containing the user data and where on the Linux system it is to be mounted. 

With the virtual machine converted and successfully mounted, the next phase of the experiemnt is to begin identifying any Alternate Data Streams that may be present on the NTFS partition. However, even browsing to the directory where the superfluous ADS were created on the command-line will still not display the Alternate Data Streams.

Interestingly, the Alternate Data Streams can be viewed by reading the extended attributes of the mounted files using a Linux command called `getfattr`. This command is incorporated into most Linux distributions by default under the package [attr](https://pkgs.org/download/attr). Following the documentation for the NTFS driver, the ADS can be read by specifying the following extended attribute in `getfattr`[^8]:

`ntfs.streams.list`

Additionally, the `getattr` command can be used recursively `-R` to search the entire NTFS partition for Alternate Data Streams and enumerate them:

```shell
getfattr -R -n ntfs.stream.list /mnt/Analysis/Windows/ 2>/dev/null | grep -B1 =
```
The output of the extended attributes display the superfluous Alternate Data Streams created at the start of the testing. Interestingly, other ADS were identified in the form of Zone Identifiers as part of Microsoft Edge, which is expected behaviour and not indicative of anything malicious. 

With the Alternate Data Streams on this particular NTFS partition identified through the extended attributes, the command-set incorporated into the Sleuth Kit can be utilised to drill down on them as follows:

```shell
fls -o 63 -Frl image.raw | grep ADS_Test
icat -o 63 image.raw 85330-128-2
```

The `fls` command was used to gather more information about the files previously located through the extended attributes. This command will automatically list the superfluous Alternate Data Streams and provide their independent inode number (MFT Entry Value). With this information, the contents of the ADS can be extracted using another Sleuth Kit command called `icat`. Using the above command, the content of `hidden.txt` was successfully extracted, in which the output can be redirected to another file on the host system if necessary for further analysis.

## Data Analysis

I thought it would be beneficial to also include a few tests that I ran during the experimentation process which either did not work as intended or outright failed, just in case anyone can learn from them. Remember that the sole purpose of this experiment was to determine whether or not I could reliably extract information from NTFS Alternate Data Streams using nothing but Linux commands against a Windows disk image. 

Originally, before I discovered that the extended attributes of the mounted NTFS partition could be read using `getfattr`, I was going to use PowerShell commands. In 2016, PowerShell was released by Microsoft as open-source and has been available ever since on their [GitHub](https://github.com/powershell/powershell) repository. Interestingly, this repository also contains PS versions suited for Linux distributions such as; Arch, Debian, Ubuntu, CentOS, RHEL and Fedora. 

Installing the RPM package on my Fedora distribution was easy and I could invoke a PowerShell prompt using the command `pwsh`. However, the PS commands I ran during the experiment would not work as intended, as the appropriate commands (`GCI` and `Get-Content`) lacked the ability to interact with data streams. I am still unsure as to precisely why this is, but I speculate that the version of PowerShell available for Linux is likely older than Version 3, which is required for ADS interaction. 

I am well aware that mounting the NTFS partition normally using the Linux `mount -o ro,loop` command would work just as well as directly specifying the NTFS driver for Linux. There is no harm to using the typical `mount` command as the extended attributes showing the ADS will still be present, regardless of whether the driver is used or not. However, I chose to explicitly use the Linux NTFS driver for the following reasons; I could specify the attribute I wanted in the output streams, and large ADS files report an error if you try to read their contents without the NTFS driver. Overall, I used the NTFS driver to make the ADS output easier to manage and more reliable. 

## Concluding Statements

The experimentation conducted as part of this article set out to determine a reliable method for locating and extracting Alternate Data Streams from an NTFS partition using Linux commands. It was found that by forensically mounting the partition to the Linux host and reading the extended attributes of the files it contains, ADS could be identified. Should any of the ADS prove suspicious or warrant further investigation, the experimentation showed that Sleuth Kit commands could extract the data from these files. 

Of course, the overall forensic relevance of ADS can be debated, however I think they are a very important aspect of Windows forensics due to their potential for Anti-Forensics. Additionally, the NTFS Alternate Data Streams have provided other useful artifacts to forensic examiners in the form of Zone Identifiers. Finally, the history ADS have in the field of information security means they could be a useful source of information to those in Incident Response.

If you have any recommendations or questions about the topics mentioned in this article, you can contact me on [Twitter](https://twitter.com/AstrumMairi).

-- Mairi

## References

[^1]: Abrams, L. (2004). [Windows Alternate Data Streams](https://www.bleepingcomputer.com/tutorials/windows-alternate-data-streams/) [Accessed 2018-06-22]
[^2]: Leibovich, T. (2018). [The Abuse of Alternate Data Stream Hasn’t Disappeared](https://www.deepinstinct.com/2018/06/12/the-abuse-of-alternate-data-stream-hasnt-disappeared/) [Accessed 2018-06-22]
[^3]: Broomfield, M. (2006). *NTFS Alternate Data Streams: focused hacking*. Network Security: Volume 2006, Issue 8
[^4]: Shamblin, Q. (2008). [Alternate Data Streams Overview](https://www.sans.org/blog/alternate-data-streams-overview/) [Accessed 2018-06-22]
[^5]: Fitzsimons, J. (2011). [Alternate Data Streams (Metadata) on Files in NTFS](https://www.curlybrace.com/words/2011/01/01/alternate-data-streams/) [Accessed 2018-06-22]
[^6]: Arntz, P. (2016). [ Introduction to Alternate Data Streams](https://blog.malwarebytes.com/101/2015/07/introduction-to-alternate-data-streams/) [Accessed 2018-06-22]
[^7]: Cyber Fibers. (2015). [Detecting Alternate Data Streams with PowerShell and DOS](https://cyberfibers.com/2015/11/detecting-alternate-data-streams-with-powershell-and-dos/) [Accessed 2018-06-22]
[^8]: Linux Man Page. [ntfsmount](https://linux.die.net/man/8/ntfsmount) [Accessed 2018-06-22]
