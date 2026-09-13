// Idempotently wires the local WidgetKit extension into the generated Xcode project.
const fs = require('node:fs');
const xcode = require('xcode');
const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const project = xcode.project(projectPath);
project.parseSync();
const app = project.getFirstTarget();
const appGroup = project.findPBXGroupKey({ path: 'App' });
if (!project.pbxGroupByName('Resources')) {
  const resources = project.addPbxGroup([], 'Resources');
  project.addToPbxGroup(resources.uuid, project.getFirstProject().firstProject.mainGroup);
}
for (const file of ['PocketWidgetPlugin.swift', 'PocketViewController.swift']) {
  if (!project.hasFile(file)) project.addSourceFile(file, { target: app.uuid }, appGroup);
}
if (!project.hasFile('PrivacyInfo.xcprivacy')) {
  project.addResourceFile('PrivacyInfo.xcprivacy', { target: app.uuid }, appGroup);
}
const targets = project.pbxNativeTargetSection();
let widgetId = Object.keys(targets).find(id => targets[id]?.name?.replaceAll('"', '') === 'ClearedTodayWidget');
if (!widgetId) {
  const widget = project.addTarget('ClearedTodayWidget', 'app_extension', 'ClearedTodayWidget', 'app.pocketcfo.mobile.widget');
  widgetId = widget.uuid;
  project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', widgetId);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', widgetId);
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', widgetId);
  const group = project.addPbxGroup([], 'ClearedTodayWidget', 'ClearedTodayWidget');
  project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
  project.addSourceFile('ClearedTodayWidget.swift', { target: widgetId }, group.uuid);
  // The second manifest must have a distinct project path from the app's copy.
  project.addResourceFile('ClearedTodayWidget/PrivacyInfo.xcprivacy', { target: widgetId }, project.getFirstProject().firstProject.mainGroup);
}
// The template has no dependency/proxy sections. node-xcode silently skips
// addTargetDependency unless both exist, so establish and verify them explicitly.
const objects = project.hash.project.objects;
objects.PBXTargetDependency ??= {};
objects.PBXContainerItemProxy ??= {};
const dependencyExists = targets[app.uuid].dependencies.some(
  dependency => objects.PBXTargetDependency[dependency.value]?.target === widgetId,
);
if (!dependencyExists) project.addTargetDependency(app.uuid, [widgetId]);
for (const file of Object.values(project.pbxBuildFileSection())) {
  if (file && typeof file === 'object' && file.fileRef === targets[widgetId].productReference) {
    file.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
  }
}
function configureTarget(id, values) {
  const target = targets[id];
  const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
  for (const config of list.buildConfigurations) {
    Object.assign(project.pbxXCBuildConfigurationSection()[config.value].buildSettings, values);
  }
}
configureTarget(app.uuid, { CODE_SIGN_ENTITLEMENTS: 'App/App.entitlements' });
configureTarget(widgetId, {
  INFOPLIST_FILE: 'ClearedTodayWidget/Info.plist',
  CODE_SIGN_ENTITLEMENTS: 'ClearedTodayWidget/ClearedTodayWidget.entitlements',
  IPHONEOS_DEPLOYMENT_TARGET: '15.0',
  SWIFT_VERSION: '5.0',
  TARGETED_DEVICE_FAMILY: '"1,2"',
  SDKROOT: 'iphoneos',
  APPLICATION_EXTENSION_API_ONLY: 'YES',
  CODE_SIGN_STYLE: 'Automatic',
  MARKETING_VERSION: '1.0',
  CURRENT_PROJECT_VERSION: '1',
  GENERATE_INFOPLIST_FILE: 'NO',
  SWIFT_EMIT_LOC_STRINGS: 'YES',
});
for (const id of [app.uuid, widgetId]) {
  project.addTargetAttribute('SystemCapabilities', {
    'com.apple.ApplicationGroups.iOS': { enabled: 1 },
  }, { uuid: id });
}
// node-xcode emits literal "undefined" for optional file attributes unless
// they are removed; Xcode should only receive real file type declarations.
function clean(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined || child === 'undefined') delete value[key];
    else clean(child);
  }
}
clean(project.hash);
for (const file of Object.values(project.pbxFileReferenceSection())) {
  if (file && typeof file === 'object' && file.path?.includes('.xcprivacy')) {
    file.lastKnownFileType = 'text.xml';
  }
}
fs.writeFileSync(projectPath, project.writeSync());
console.log('iOS app and WidgetKit extension are configured.');
