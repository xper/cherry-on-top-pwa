import * as React from "react";
import { useRouter } from "next/router";
// import { Trans } from "@lingui/macro";

import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Language as LanguageIcon,
} from "@mui/icons-material";

import Link from "../src/Link";
import locales from "../src/lib/locales";

export default function MyAppBar({ title }: { title: string }) {
  const router = useRouter();
  const { pathname, asPath, query } = router;
  const [anchorElLang, setAnchorElLang] = React.useState(null);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>

          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={(event) => setAnchorElLang(event.currentTarget)}
          >
            <LanguageIcon />
          </IconButton>

          <Menu
            id="lang-select"
            anchorEl={anchorElLang}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "left",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "left",
            }}
            open={Boolean(anchorElLang)}
            onClose={() => setAnchorElLang(null)}
            sx={{
              display: { xs: "block", md: "block" },
            }}
          >
            {Object.values(locales).map((locale) => (
              <MenuItem
                key={locale.id}
                onClick={() => {
                  router.push({ pathname, query }, asPath, {
                    locale: locale.id,
                  });
                  setAnchorElLang(null);
                }}
              >
                <Typography textAlign="center">
                  <Link
                    href={asPath}
                    color="inherit"
                    underline="none"
                    locale={locale.id}
                  >
                    {locale.label[locale.id]}
                  </Link>
                </Typography>
              </MenuItem>
            ))}
          </Menu>
          {/* 
            <Button color="inherit">Login</Button>
          */}
        </Toolbar>
      </AppBar>
    </Box>
  );
}
