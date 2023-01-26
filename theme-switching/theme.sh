#!/usr/bin/bash

set_light() {
  echo Setting Light Mode
  /home/jcake/Applications/plasma-theme-switcher/plasma-theme -w kvantum -c /home/jcake/.local/share/color-schemes/FluentLight.colors
  echo light | nc localhost 16666
  exit 0
}

set_dark() {
  echo Setting Dark Mode
  /home/jcake/Applications/plasma-theme-switcher/plasma-theme -w kvantum-dark -c ~/.local/share/color-schemes/FluentDark.colors
  echo dark | nc localhost 16666
  exit 1
}

if [[ $* == *--dark* ]]
then
  set_dark;
elif [[ $* == *--light* ]]
then
  set_light;
fi

if [[ $* == *--auto* ]]
then
  if node -e 'process.exit(!((x,l,u)=>x>=l&&x<u)((d=>d.getHours()+d.getMinutes()/60)(new Date()),7,19)?1:0)'
  then
    set_light;
  else
    set_dark;
  fi
fi

cat ~/.kde/share/config/kdeglobals | grep ColorScheme | awk -F '=' '{ print $2 }' | grep -i light > /dev/null

if [[ $? -eq 0 ]]
then
  echo Light
  exit 0
else
  echo Dark
  exit 1
fi
