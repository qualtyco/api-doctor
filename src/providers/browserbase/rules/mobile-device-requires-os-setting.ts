/**
 * browserbase-mobile-device-requires-os-setting (correctness)
 *
 * The Node SDK has no `fingerprint.devices`/`operatingSystems` API (that is
 * a Python-SDK-only shape) — device/OS emulation in Node is
 * `browserSettings.os: 'mobile' | 'tablet'`. A "mobile" combo that only
 * resizes the Playwright viewport, without setting `browserSettings.os`, is
 * still a desktop Chrome browser with a desktop user-agent in a small
 * window — sites that branch on UA/touch capability never see real mobile
 * behavior.
 */
import { someDescendant } from '../utils.js';

function isMobileLiteral(node: any): boolean {
  return node?.type === 'Literal' && (node.value === 'mobile' || node.value === 'tablet');
}

function testComparesToMobile(test: any): boolean {
  if (test?.type !== 'BinaryExpression') return false;
  if (test.operator !== '===' && test.operator !== '==') return false;
  return isMobileLiteral(test.left) || isMobileLiteral(test.right);
}

function isViewportReference(node: any): boolean {
  if (node?.type === 'Identifier') return /viewport/i.test(node.name);
  if (node?.type === 'MemberExpression' && !node.computed && node.property?.type === 'Identifier') {
    return /viewport|width|height/i.test(node.property.name);
  }
  if (node?.type === 'Property') {
    return node.key?.type === 'Identifier' && /viewport|width|height/i.test(node.key.name);
  }
  return false;
}

function setsViewport(node: any): boolean {
  return someDescendant(node, isViewportReference);
}

function isOsMobileSetting(node: any): boolean {
  // `os: 'mobile'` / `os: 'tablet'` object property
  if (node?.type === 'Property' && node.key?.type === 'Identifier' && node.key.name === 'os' && isMobileLiteral(node.value)) {
    return true;
  }
  // `<x>.os = 'mobile'` assignment
  if (
    node?.type === 'AssignmentExpression' &&
    node.left?.type === 'MemberExpression' &&
    !node.left.computed &&
    node.left.property?.type === 'Identifier' &&
    node.left.property.name === 'os' &&
    isMobileLiteral(node.right)
  ) {
    return true;
  }
  return false;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Mobile device combos must set browserSettings.os, not just resize the viewport',
      category: 'correctness',
      rationale:
        "The Node SDK's device emulation lever is browserSettings.os: 'mobile' | 'tablet' — there is no fingerprint API in this SDK. A \"mobile\" session that only resizes the Playwright viewport is still a desktop Chrome browser with a desktop user-agent string in a small window. Sites that branch behavior on UA/touch capability (the majority of responsive sites) never actually exercise their mobile code path, silently undermining \"test on mobile\" results.",
      docsUrl: 'https://docs.browserbase.com/features/stealth-mode',
      recommended: true,
    },
    messages: {
      missingOsSetting:
        'A "mobile" branch resizes the viewport but never sets browserSettings.os to "mobile"/"tablet". Without it this is still a desktop browser in a small window.',
    },
    schema: [],
  },
  create(context: any) {
    const mobileViewportBranches: any[] = [];
    let sawOsMobileSetting = false;

    return {
      IfStatement(node: any) {
        if (testComparesToMobile(node.test) && setsViewport(node.consequent)) {
          mobileViewportBranches.push(node);
        }
      },
      Property(node: any) {
        if (isOsMobileSetting(node)) sawOsMobileSetting = true;
      },
      AssignmentExpression(node: any) {
        if (isOsMobileSetting(node)) sawOsMobileSetting = true;
      },
      'Program:exit'() {
        if (sawOsMobileSetting) return;
        for (const branch of mobileViewportBranches) {
          context.report({ node: branch, messageId: 'missingOsSetting' });
        }
      },
    };
  },
};

export const browserbaseMobileDeviceRequiresOsSettingRule = rule;
export default rule;
