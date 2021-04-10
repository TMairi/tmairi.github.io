---
title: Forensic Acquisition with DD Tools
author: Mairi
date: 2018-01-28 00:00:00 +0100
categories: [DFIR, Linux]
tags: [dfir, linux]
comments: false
---

## Foreword

> **DISCLAIMER**: This article was written by myself and was previously posted on a now-defunct website on 2018-01-28. I backed up the original contents of the article prior to the website shut-down and am now reposting it here for preservation. All information was correct and accurate at the time this article was written.

This article will be focusing on the usage of the Linux tool `dd` in the forensic imaging process, along with several tools that have been derived from it. In addition to briefly covering the issue of data completeness when preparing to conduct forensic acquisition.

## Introduction

Data Duplication/Dump/Definition `dd` is a command-line tool primarily used in Unix Operating Systems. It serves a very simple, yet useful purpose; to copy data from a specified source to a specified destination. Typically, this will be done bit-by-bit, regardless of any file systems or operating systems that may be present. 

The `dd` command is typically installed by default in most GNU/Linux distributions under a package called `coreutils`. However, its derivatives, which will be shown later in this post may need to be installed manually. If necessary, I will include more details about the manual installation of these tools as they are mentioned. 

Owing to the many implementations of the Linux operating system, it is not uncommon to find `dd` installed on devices running Android[^1]. In addition, the `dd` tools can be implemented over a network using utilities like `cryptcat`[^2]. However, this article will be focusing on traditional storage device imaging using the `dd` tool(s) in a non-live, local environment.

### Linux Block Devices

Because everything in Linux is technically interpreted as a file, this means `dd` can interact with a plethora of data. One of the most important pieces of data being “special” files in Linux; such as block devices like `/dev/sda`. 

These block devices are of the most interest to us, as they can represent physical drives attached to your host system; ranging from hard drives to optical drives and even NVME devices. Drives attached to a Linux host system will be assigned a special device in the `/dev` directory by the kernel. The naming convention for these device files includes, but is not limited to:

| BLOCK DEVICE | TYPE |
| :-: | :-: |
| `/dev/sdX` | SATA / SCSI / Serial drives |
| `/dev/hdX` | IDE drives |
| `/dev/fdX` | Floppy drives |
| `/dev/mdX` | RAID arrays |

Where '*X*' is a letter of the alphabet starting from ‘a’, (or a number starting from 0, for floppy drives) denoting the order of the devices. For example; your primary SATA hard drive which boots into Linux will be `/dev/sda`, while a secondary SATA hard drive will be `/dev/sdb`. 

In addition, these block devices will often have similar files denoting partitions for each drive, which is usually done by appending a number to the block device. For example, the first partition of your primary SATA hard drive will be `/dev/sda1` (typically the ‘boot’ partition). However, for the purposes of this article, I am only going to be focusing on the raw device files for the drives themselves and not those of the partitions.

### In a Forensic Environment

In the context of digital forensic investigation; the `dd` tool and its derivatives can be used to read data from the device file of an attached drive and write this data to a raw image file. Bear in mind that the data you acquire from a device such as a hard drive, may not necessarily be complete (see '**Data Completeness**' section below). The resulting raw image file can then be easily imported into an appropriate analysis suite, or interrogated with other command-line tools. 

I personally prefer to use Linux for performing digital forensics whenever I can, and I find `dd`, along with its variants, to be invaluable tools. I would highly recommend using low-level command-line tools like `dd` to better understand the forensic process before utilizing the well-known commercial tools.

## Data Completeness

Understanding the issue of data completeness is fundamental in the forensic acquisition process, especially when dealing with Hard Drive Disks (HDDs). There are caveats to consider when using imaging tools such as `dd`, one of them being that they may not have access to **ALL** of the data stored on a device. In most cases, this relates to ‘hidden areas’ commonly found on hard drives, which are typically inaccessible to the Operating System or the BIOS. 

The two most common ‘hidden areas’ of a hard drive are known as the Host Protected Area (HPA) and the Device Configuration Overlay (DCO). The HPA was implemented to allow manufacturers to store diagnostic, monitoring and recovery tools on-disk. The DCO was introduced in ATA-6 and is used by manufacturers to change features between drive models and/or alter the observable capacity of the disk. These two hidden areas are simply sectors on the drive which have been specified as ‘protected’ by the drives configuration[^3]. 

The third and perhaps most important ‘area’ to be aware of is referred to as the Service Area, or System Area. This area can occupy a significant part of the drives total capacity and is used to store information such as:

* SMART data
* Defective sector lists (P/G lists)
* Firmware code
* ATA passwords
* Servo information

Accessing the data contained in the Service Area is normally only possible via vendor-owned proprietary commands. However, Todd Shipley demonstrated via a proof-of-concept that it is possible to write data to this area, which has interesting implications for anti-forensics[^4].

It is vital to not only be aware of, but try and account for these hidden areas when conducting an investigation. Some commercial forensic software will take measures to deal with these areas, however, more so the HPA/DCO, than the Service Area. It is not uncommon for such software, or even certain write blockers, to check for the existence of HPA/DCO areas before an image is acquired[^5]. On Linux, it is possible to 'remove' these areas by using tools such as `hdparm`, but this is outside the scope of this article.

Finally, while I am on the topic of data completeness, the USB flash drive I will be using to show off the functionality of the `dd` tools (see '**Testing Preparation**' section below) has similar issues. All USB devices contain a hierarchy of data known as ‘descriptors’ which are used to provide information to the host system, mainly to determine the appropriate driver(s). This information includes, but is not limited to;

* Vendor and Manufacturer data
* USB device type
* Supported USB versions
* Configuration details
* Serial number of the device
* Number of endpoints

The primary descriptor found on USB drives is known as the ‘device descriptor’, which encompasses the entire device and is at the top of the hierarchy[^6]. Although the device descriptor contains forensically relevant information about the USB drive, this data is stored in the Read-Only Memory (ROM) chip and will **NOT** be imaged when using tools like `dd`.

## Testing Preparation

I am going to be using the `dd` tools on a Linux system to acquire an image of an unmounted 1GB USB flash drive, without any additional hardware. In a forensic environment, the drive being imaged would ideally be connected to an appropriate hardware write blocker to preserve data integrity, along with any other procedures being taken to ensure data completeness.

You may wonder why the USB device I will be connecting to the Linux host system is assigned a block device with the naming convention `/dev/sdX`, considering the device is not connected through a SATA/SCSI interface. This is because, as of kernel version 3.15, Linux utilises a protocol called USB Attached SCSI (UAS) to facilitate the reading/writing of data to USB mass storage devices[^7]. 

With UAS; the SCSI command set is used for communicating with the USB device and is why, in this case, the block device uses the SCSI naming convention. You can see this process in the `dmesg` output when the USB device is connected to the host system.

> **WARNING**: It is very important to note before I continue that `dd` is very unforgiving, especially if you enter the incorrect source and destination values. Therefore, if you are unfamiliar with `dd` I would highly recommend you run it in a controlled environment first, lest you risk corrupting or destroying your data. Always ensure you know how the tools and commands work before you run them in a live environment!

## Tool #1: DD

As mentioned previously, the standard `dd` tool is installed by default on most GNU/Linux distributions under the `coreutils` package[^8]. Using `dd` on the Linux command-line is very simple and given the block device we want to image is `/dev/sdb`, a typical `dd` command might look like this:

```plaintext
dd if=/dev/sdb of=USB_image.dd bs=4k conv=noerror,sync status=progress
```

### DD Parameters

* `if=/dev/sdb`: This is our input (source) file (`if`), which in this case is the block device associated with the USB device.
* `of=USB_image.dd`: The output (destination) file (`of`), which will be a raw image file consisting of all the accessible data on the USB device acquired by DD.
* `bs=4k`: This specifies the size of the data blocks to be copied from the input file in bytes. If this option is not specified, it will default to a block size of 512, analogous to the traditional sector size on a hard drive. In this case, I used a block size of 4k (4096), which was optimal for my setup[^9]. Larger block sizes are used for efficiency purposes but I would recommend using smaller block sizes where possible, because if you encounter read errors, you risk zero-filling readable data on a larger block size.
* `conv=noerror,sync`: This option is vital if you run the `dd` command against a disk you suspect of having ‘bad’ or ‘defective’ blocks/sectors. Normally, the `dd` tool will abruptly terminate the command if a read error is encountered from the source drive, which the `noerror` parameter prevents. However, you will also need to use the `sync` option in conjunction with `noerror`, which will pad any unreadable ‘bad’ blocks with zeros in the output file. Bear in mind that should this occur, the resulting image will not match the original drive when hashes are calculated for each. To counter this, you can calculate hashes in specified intervals using the `dcfldd` tool (see **DCFLDD** tool section below).

### Reading the MBR

I personally do not use traditional `dd` for forensic imaging, however, it is very useful when extracting key excerpts of data from a drive. For example, the following `dd` command will extract the first 512 bytes of the accessible data, known as the Master Boot Record (MBR):

```plaintext
dd if=/dev/sdb of=USB_mbr.dd bs=512 count=1
```

* `count=1`: This specifies how many blocks, whose size we define with `bs`, are to be extracted. In the above command; I only required a single block, starting at the beginning of the accessible data. This particular block of data is also referred to as the MBR ‘boot sector’ (`0x55AA` signature), which contains partition and Operating System information, as well as boot code used by the BIOS.

### Additional Parameters

A few other less common parameters used with `dd`, along with their function, are described as follows:

* `skip=X`: Where '*X*' is an integer. This option will exclude X amount of blocks, of block size `bs=X`  at the start of the input file. For example, if an input file of 100 blocks is imaged with `skip=1`, the resulting output file will be 99 blocks in size, having excluded the first block.
* `conv=sparse`: This option should generally be used to save space on the file system, as any zeroed blocks in the output file wont be written to disk. For further reading into sparse files, I recommend this [resource](https://wiki.archlinux.org/index.php/Sparse_file).
* `status=progress`: This option will cause DD to show periodic transfer statistics such as; the amount of bytes copied, the elapsed time and the data transfer rate. Typically used for convenience purposes but can help determine optimal block sizes.

## Tool #2: DCFLDD

The first tool I will cover that has been forked from the DD project is called `dcfldd`, which was developed by the Department of Defense Computer Forensic Lab and is considered to be an enhanced version of the traditional `dd`. It boasts notable improvements over the original such as:

* Multiple output file support
* Hash verification
* Hashing during data transfer
* Split output file support
* Log file support
* In-built status progress

Bear in mind that `dcfldd` does not support any output format other than 'RAW', meaning this tool cannot be used to output to forensic formats such as AFF, EWF, E01, etc. In addition, this tool should not be used when dealing with disks you suspect of containing defective sectors, due to a known issue in the tool itself[^10].

Most of the common Linux distributions contain `dcfldd` in their core repositories and can be very easily installed from the command line. For a list of commands to help install `dcfldd`, please check for the appropriate distribution [here](https://pkgs.org/download/dcfldd). Note that Arch Linux and CentOS distributions will require additional repositories to be setup before `dcfldd` can be installed. 

When using `dcfldd` on the Linux command-line; given the block device we want to image is `/dev/sdb`, a typical command would look like this: 

```plaintext
dcfldd if=/dev/sdb of=USB_Image.dd of=USB_Image2.dd bs=4k conv=noerror,sync hash=sha256 hashwindow=100MB sha256log=USB_Image.hash
```
### DCFLDD Parameters

The `bs` and `conv` parameters have not changed from their usage in the DD tool, please refer to the previous demonstration of `dd` for more details on these options. 

* `of=USB_Image2.dd`: In the command above, I have specified a second output file option, with a different file name, meaning I end up with two identical images of the source file (`/dev/sdb`). This may not be useful when dealing with very large datasets, however it does allow an examiner to save an image to different locations if necessary.
* `hash=sha256`: This option selects the hashing algorithm SHA-256 to be used when calculating a cryptographic hash of the input and output files. The hashing algorithms MD5, SHA-1, SHA-256, SHA-384 and SHA-512 are currently supported within `dcfldd`. I would not recommend using MD5 or SHA-1 as they have been cryptographically broken[^11].
* `hashwindow=100MB`: As mentioned previously, this option will calculate a hash of the data in specified intervals, in this case, every 100MB of data. This can be seen in the output log file specified with the next option.
* `sha256log=USB_Image.hash`: A good example of the logging functionality of `dcfldd`, this option designates a separate file which will store the calculated hashes we specified previously. As shown in command above, this file contains a hash value for each 100MB of data, including the value for the whole data at the end. To check that this last hash value matched the source device, I ran `sha256sum` against the block device.

The `dcfldd` tool contains many other options and I would recommend reading through the man page if you want to take full advantage of its functionality. Like traditional `dd`; `dcfldd` also contains the options `count`, `skip` and `status`, except the status command operates with a simple on/off parameter instead (e.g. `status=on`).

Like `dd`, I do not personally use `dcfldd` for forensic acquisition, primarily due to the reported issues it has with defective sectors. However, the ability to calculate a hash value at specified intervals can prove very useful in some circumstances.

## Tool #3: DC3DD

The second derivative of dd that I am covering is `dc3dd`, which was developed by the Department of Defense Cyber Crime Center. DC3DD is very syntactically and functionally similar to the previous tool `dcfldd`. However, there are some slight differences between the two, the most notable being that the `conv=noerror,sync` option and the progress bar are built into `dc3dd` by default. Additionally, `dc3dd` allows for automatic hash verification, which is a very useful feature not found in the other DD tools.

Again, most of the common Linux distributions contain `dc3dd` in their core repositories and can be very easily installed from the command line. For a list of commands to help install `dc3dd`, please check the appropriate distribution [here](https://pkgs.org/download/dc3dd). Note that CentOS will require either the EPEL, Repoforge or CERT Forensic repositories to be setup beforehand. 

Using `dc3dd` on the Linux command-line has plenty of options for forensic examiners. Given the block device we want to image is `/dev/sdb`, a typical `dc3dd` command would look like this: 

```plaintext
dc3dd if=/dev/sdb hof=USB_Image.dd log=USB_Image.log hash=sha256 hash=sha512 hlog=USB_Image.hash
```

### DC3DD Parameters

* `hof=USB_Image.dd`: This option will calculate a hash of the specified output file, as well as compare this value to the one calculated for the input file. Should the hashes match, the command will output ‘[ok]’ next to the hash values in `STDOUT`. 
* `log=USB_Image.log`: This option will write the contents of `STDOUT` to a specified file. This is useful because if you plan on using `dc3dd` multiple times, you can write to the same log file each time, as it will not be overwritten. 
* `hlog=USB_Image.hash`: Specifies a file where the hash value comparison is written to. If the hash verification is written to `STDOUT`, it will appear here and in the file specified by `log=`.

### Additional Parameters

As seen before in `dcfldd`, I manually specified which hash algorithms I wanted the tool to use with the `hash=` option. I used two (SHA-256 and SHA-512), with the same rational that MD5 and SHA-1 are broken. It is worth noting that `dc3dd` has different names for the options seen in the previous tools, which I have listed as follows:

* `count = cnt`: Will read a specified amount of blocks from the input file. The size of these blocks can be altered with the `ssz` option below.
* `skip = iskip/oskip`: Here `skip` is split into two options for input and output. `iskip` will specify the amount of blocks to skip at the start of the input file and `oskip` will specify the same but for the output file.
* `bs = ssz`: The default block size in `dc3dd` is 512, but this can be manually overwritten using `ssz`. Bear in mind that this will still accept non-absolute values like ‘4k’ (4096).

The `dc3dd` derivative tool is an excellent choice for forensic examiners due its hash verification and advanced logging features. In the forensic imaging process, I personally use a combination of this tool and the next one; `ddrescue`. As a side note; `dc3dd` is the imaging tool utilised in Bruce Nikkel’s `sfsimage` program, which I highly recommend checking out [here](https://digitalforensics.ch/sfsimage/).

## Tool #4: DDRESCUE

The final tool I will be covering is technically not a derivative of `dd`, but functions in a very similar way and is very useful for forensic imaging, despite being considered a ‘data recovery’ tool. The tool `ddrescue` was developed as part of the GNU project and is not to be mistaken with `dd_rescue`, which `ddrescue` is considered to be an improvement upon[^12]. Because `ddrescue` is primarily focused on data recovery, it is the ideal tool to utilise on devices that are suspected to contain ‘bad’ blocks. 
	
Like the previous two tools, `ddrescue` is fairly easy to install on most Linux distributions due to its inclusion in their core repositories. For a list of distributions with appropriate commands and instructions needed to install `ddrescue`, please refer to this [resource](https://pkgs.org/download/ddrescue).

Despite being more oriented towards data recovery, `ddrescue` still provides options which will prove useful for forensic practitioners. As before, assuming the device we want to image is `/dev/sdb`, a typical `ddrescue` command would look like this:

```plaintext
ddrescue -d /dev/sdb USB_Image.dd USB_Image.map
```
### DDRESCUE Parameters

Note how we do not need to specify the `if` and `of` options for the input and output files respectively as seen in the other tools.

* `-d / --idirect`: This option specifies direct disc access for the input file and will bypass the kernel cache. Note that not all systems support direct disc access and `ddrescue` will warn you if your system does not. 
* `USB_Image.map`: This is the third parameter of `ddrescue` and despite being optional, it is highly recommended you use a map file. Note that the map file does not need to obey any naming convention like `*.map` and can be named however you wish. The map file will contain important information about the imaging process, specifically whether there were any read errors during the acquisition. Additionally, should the imaging process be interrupted for any reason, the map file will keep track of the recovered data and as long as the same map file is specified, the imaging can resume where it left off. 

The [documentation](https://www.gnu.org/software/ddrescue/manual/ddrescue_manual.html) for `ddrescue` is very robust and well worth reading through if you have time. From the manual I have picked out some features that I found particularly interesting:

* Specifying the option `-R` will read the input file in reverse passes. Like many of the options, this is used mainly to maximise recovered data on bad disks. 
* Should `ddrescue` encounter bad sectors on the input file you are imaging, it will not write zeros to the output file in their place like the other `dd` tools will do. 
* The physical block size will be dynamically decreased to maximise recovered data should `ddrescue` encounter bad sectors on the input file.
* Any interface (ATA, SATA, SCSI, etc.) supported by your kernel can be used with `ddrescue`.
* The `-i` option can be used to specify a starting position on the input file. The option defaults to offset `0` if not specified.

## Concluding Statements

I decided to discuss data completeness at the beginning of this article because I believe it is very important for forensic practitioners to understand exactly what data they are acquiring from a device, and consider that it may not always be ‘forensically complete’. 

All the tools covered in this article have their own strengths and weaknesses so your individual circumstances will be the biggest factor in deciding which you want to use. However, in my opinion, I would always utilise `ddrescue` for imaging drives whenever possible due to its focus on recovering ‘good’ data. Of course, you may not necessarily be in a position to choose one over the other, which is why I emphasise learning how each of them work. 

I am aware that there are many other uses/options for the tools covered in this article, but I wanted to show that fundamentally, the forensic imaging process can be completed with command-line tools on Linux. Finally, this is by no means an exhaustive list of imaging tools fit for every possible scenario you may come across.

If you have any recommendations or questions about the topics mentioned in this article, you can contact me on [Twitter](https://twitter.com/AstrumMairi).

-- Mairi

## References

[^1]: Burles, N. (2013). [Recovering data from an Android device using dd](https://www.nburles.co.uk/android/recovering-data-from-an-android-device-using-dd) [Accessed 2018-01-28]
[^2]: Shema, M., Davis, C. and Cowen, D. (2004). *Anti-Hacker Tool Kit*, 3rd Ed. California: McGraw-Hill
[^3]: Nikkel, B. (2016). *Practical Forensic Imaging*. San Francisco: No Starch Press, Inc.
[^4]: Shipley, T. and Door, B. (2016) [Hiding Data from Forensic Imagers – Using the Service Area of a Hard Disk Drive](https://www.forensicfocus.com/articles/hiding-data-from-forensic-imagers-using-the-service-area-of-a-hard-disk-drive/) [Accessed 2018-01-28]
[^5]: Shipley, T. and Door, B. (2012). [Forensic Imaging of Hard Disk Drives- What we thought we knew](https://www.forensicfocus.com/articles/forensic-imaging-of-hard-disk-drives-what-we-thought-we-knew-2/) [Accessed 2018-01-28]
[^6]: Peacock, C. (2018). [USB Descriptors](https://www.beyondlogic.org/usbnutshell/usb5.shtml#DeviceDescriptors) [Accessed 2018-01-28]
[^7]: Larabel, M. (2014). [USB Attached SCSI (UAS) Is Now Working Under Linux](https://www.phoronix.com/scan.php?page=news_item&px=MTcyMTk) [Accessed 2018-01-28]
[^8]: ForensicsWiki. (2013). [Dd](https://forensicswiki.xyz/wiki/index.php?title=Dd) [Accessed 2018-01-28]
[^9]: Gunther, D. (2015). [Tuning dd block size](http://blog.tdg5.com/tuning-dd-block-size/) [Accessed 2018-01-28]
[^10]: Lyle, J. R. and Wozar, M. R. (2007). *Issues with Imaging Drives Containing Faulty Sectors*. Digital Investigation: Volume 4
[^11]: Umbelino, P. (2017). [SHAttered — SHA-1 Is Broken In](https://hackaday.com/2017/02/23/shattered-sha-1-is-broken/) [Accessed 2018-01-28]
[^12]: jabby. (2011). [ddrescue vs. dd_rescue](https://lwn.net/Articles/430000/) [Accessed 2018-01-28]
