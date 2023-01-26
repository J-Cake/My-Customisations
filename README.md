# My-Customisations
Here is a collection of scripts and utilities I've written that I use to customise my desktop

## Theme Switching

KDE Plasma doesn't (yet) have the facilities to automatically switch between light and dark themes, so I wrote such a system myself.

### How it works:

It's quite simple, it's not a gigantic script, but it does require the [Deno](https://deno.land) runtime to work. If it's installed, then everything should work.

However, for it to do anything useful, you need to set a few config options:

```json ~/.config/theme.json
{
	"light": "/home/<user>/.local/share/color-schemes/<light>.colors",
	"dark": "/home/<user>/.local/share/color-schemes/<dark>.colors",
	"cache": "/home/<user>/.cache/theme.json",
	"ipinfoToken": "<ipinfo.io API token>",
	"switch": "07:00-19:00"
}
```

* `light`: Specifies the colour scheme to use for the light theme
* `dark`: Specifies the colour scheme to use for the dark theme
* `cache`: Used internally for caching things
* `ipinfoToken`: The API token for ipinfo.io
	- This option is not strictly required, but if you wish to switch your themes in accordance to sunrise/sunset times, you will need an access token.
	- These can be easily and freely created through their website at [the dashboard](https://ipinfo.io/account/token)
* `switch`: The times at which to switch themes
	- Defaults to 07:00 for light and 19:00 for dark
	- Syntax must be exactly as follows:
		`hh:mm-hh:mm`
	- Not strictly required if using automatic (sun-determined) switching

### Running

I run mine through cron using the provided `cron.sh` script which rehydrates the environment for scripts to use, as cron strips environment variables before executing jobs

```bash
: crontab -e
...
@reboot	cron.sh theme.sh
...
```

## Automated Daily Wallpapers

I love keeping my desktop fresh. The most impactful way to do this is with a new wallpaper every day. I've tried many variations of providers, but quickly realised that Bing has already solved this problem and is available to use freely.

Why do I use this approach?

It's twofold; KDE Plasma already has a built-in bing image-of-the-day service, which probably works better than this one, but has one small issue

1. I like to use the [Inactive Blur](https://store.kde.org/p/1206340/) plugin for KDE to blur my wallpaper when windows are open to help me concentrate, which doesn't support the daily wallpaper, only static images
2. I can control which image I'd like to use (I can go back arbitrarily far in history)

### How to use it:

It can run as a systemd job, or under cron the way the automated theme switching does.

* Systemd: ```bash
: systemctl --user enable wallpaper.service
: systemctl --user start wallpaper.service
```

I also have a plasma widget to control the wallpaper service:

[!The _Command Output Settings_ window shows how I configure my wallpaper from my desktop, as well as giving a description of the image, provided by Bing.](./res/Screenshot_20230126_012944.png)

* Cron: ```bash
: crontab -e
...
@reboot	cron.sh node get-wallpaper.js --refresh 600
...
```

* The `--image <offset>` flag passed to `get-wallpaper.js` (takes a negative integer) controls which image to display
* The `--refresh <seconds>` flag controls how often the service will fetch new wallpapers and their corresponding details. 

