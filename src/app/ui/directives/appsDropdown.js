/* @ngInject */
function appsDropdown() {
    return {
        scope: {},
        replace: true,
        restrict: 'E',
        templateUrl: require('../../../templates/ui/appsDropdown.tpl.html')
    };
}
export default appsDropdown;
