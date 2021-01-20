# Twitter Natural Advanced Search
This is a small chrome extension which lets you twitter search fields auto detect search that resembles "advanced search", that is currently today accessible through the advanced search UI or through their own syntax that might not be the easiest. It supports all possible advanced searches!

![Demo search](/../master/screenshot.PNG?raw=true)

*"from elonmusk about bitcoin between 2011-01-10 and today include links english"*

## How to use
Download one the [chrome store](https://chrome.google.com/webstore/detail/twitter-natural-advanced/fkjippcbpjcnjfoohfhaghfelfanamee) or clone the repo and use this as a development extension.

If you type in a search field and get a matching advanced search suggestion you press shift + enter, to apply it. It wont apply automatically when pressing enter.

You can toggle suggestions and keywords with ctrl + space.


## How it works
It uses [query.quantleaf.com](https://query.quantleaf.com) under the hood to convert natural languages to the advanced search format. See the file *inject.js* to learn about how it was implemented for this tool. 

 
<br/>
<br/>

**Enjoy! 🏄🏼‍♀️**

// Marcus