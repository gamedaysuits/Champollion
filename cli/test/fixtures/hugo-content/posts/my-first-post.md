---
title: "My First Blog Post"
description: "An introduction to Hugo and static site generation"
date: 2024-01-15
draft: false
tags:
  - hugo
  - tutorial
author: Curtis Forbes
---

# Getting Started with Hugo

Welcome to my blog! This post will guide you through setting up your first Hugo site.

## Prerequisites

Before we begin, make sure you have the following installed:

- Hugo (v0.120 or later)
- Git
- A text editor

## Installation

You can install Hugo using your package manager:

```bash
brew install hugo
hugo new site my-site
cd my-site
```

## Creating Content

Hugo uses **Markdown** for content. You can create a new post with:

```bash
hugo new posts/my-first-post.md
```

This will generate a file with front matter already set up.

## Hugo Shortcodes

Hugo provides built-in shortcodes for common elements:

{{< figure src="/images/hugo-logo.png" alt="Hugo Logo" caption="The Hugo mascot" >}}

You can also use custom shortcodes:

{{% notice tip %}}
Always use `hugo server -D` during development to see draft content.
{{% /notice %}}

## Conclusion

Hugo is a powerful static site generator that makes building websites a breeze. Check out the [official documentation](https://gohugo.io/documentation/) for more details.

Happy coding! 🎉
