const baseStyle = ` <style>
        /* Base styles for all templates */
        .base-style {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f8f8f8;
            -webkit-font-smoothing: antialiased;
        }
        .wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .content {
            padding: 20px;
            color: #333333;
            line-height: 1.6;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #666666;
            padding: 20px;
            border-top: 1px solid #eeeeee;
        }
    </style>`;

const template1 = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
    ${baseStyle}
</head>
<body class="base-style">
    <table class="wrapper" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 40px 20px; text-align: center; background-color: #333333; color: #ffffff;">
                            <h1 style="margin: 0; font-size: 24px;">{{ title }}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td class="content">
                            <p style="font-size: 18px; color: #333333;">Hello {{ name }},</p>
                            <div style="margin: 20px 0;">
                                {{ content }}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="footer">
                            &copy; 2025 {{ company }}. All rights reserved.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

const template2 = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
    ${baseStyle}
</head>
<body class="base-style">
    <table class="wrapper" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 30px; background-color: #f2f2f2;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td width="50%" style="padding-right: 15px;">
                                        <h1 style="margin: 0; font-size: 24px; color: #333333;">{{ title }}</h1>
                                    </td>
                                    <td width="50%" style="padding-left: 15px;">
                                        <p style="margin: 0; color: #666666;">{{ subtitle }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td class="content">
                            <p>Dear {{ name }},</p>
                            {{ content }}
                        </td>
                    </tr>
                    <tr>
                        <td class="footer">
                            &copy; 2025 {{ company }}. All rights reserved.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

const template3 = `

<!-- Template 3: Minimal Border -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
     ${baseStyle}
</head>
<body class="base-style">
    <table class="wrapper" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e0e0e0;">
        <tr>
            <td>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 20px; border-bottom: 2px solid #333333;">
                            <h1 style="margin: 0; font-size: 20px; color: #333333;">{{ title }}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td class="content">
                            <p style="color: #666666;">Hello {{ name }},</p>
                            {{ content }}
                        </td>
                    </tr>
                    <tr>
                        <td class="footer">
                            <p style="margin: 0;">&copy; 2025 {{ company }}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

const template4 = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
     ${baseStyle}
</head>
<body class="base-style">
    <table class="wrapper" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td style="padding: 40px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #333333;">{{ title }}</h1>
                            <p style="margin: 0; color: #666666;">Dear {{ name }},</p>
                            <div style="margin: 20px 0; text-align: left;">
                                {{ content }}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="footer">
                            &copy; 2025 {{ company }}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

const template5 = `

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
 ${baseStyle}
</head>
<body class="base-style">
    <table class="wrapper" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td style="border-top: 4px solid #333333;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 40px 20px;">
                            <h1 style="margin: 0 0 30px 0; font-size: 28px; color: #333333;">{{ title }}</h1>
                            <p style="margin: 0; color: #666666; font-size: 16px;">Hello {{ name }},</p>
                            <div style="margin: 20px 0;">
                                {{ content }}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="footer" style="background-color: #f8f8f8;">
                            <p style="margin: 0;">&copy; 2025 {{ company }}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;


const templates = [template1, template2, template3, template4, template5];

export function getEmailTemplate(templateId: number) {
    return templates[templateId];
}

export function getRandEmailTemplate() {
    return templates[Math.floor(Math.random() * templates.length)];
}

export default getRandEmailTemplate