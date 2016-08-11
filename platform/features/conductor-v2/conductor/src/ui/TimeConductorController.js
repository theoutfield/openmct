/*****************************************************************************
 * Open MCT Web, Copyright (c) 2014-2015, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT Web is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT Web includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

define(
    [
        './TimeConductorValidation'
    ],
    function (TimeConductorValidation) {

        function TimeConductorController($scope, timeConductor, conductorViewService, timeSystems) {

            var self = this;

            //Bind all class functions to 'this'
            Object.keys(TimeConductorController.prototype).filter(function (key) {
                return typeof TimeConductorController.prototype[key] === 'function';
            }).forEach(function (key) {
                self[key] = self[key].bind(self);
            });

            this.$scope = $scope;
            this.conductorViewService = conductorViewService;
            this.conductor = timeConductor;
            this.modes = conductorViewService.availableModes();
            this.validation = new TimeConductorValidation(this.conductor);

            // Construct the provided time system definitions
            this.timeSystems = timeSystems.map(function (timeSystemConstructor){
                return timeSystemConstructor();
            });

            //Set the initial state of the view based on current time conductor
            this.initializeScope();

            this.conductor.on('bounds', this.setFormFromBounds);
            this.conductor.on('follow', function (follow){
                $scope.followMode = follow;
            });
            this.conductor.on('timeSystem', this.changeTimeSystem);

            // If no mode selected, select fixed as the default
            if (!this.conductorViewService.mode()) {
                this.setMode('fixed');
            }
        }

        /**
         * @private
         */
        TimeConductorController.prototype.initializeScope = function() {
            //Set time Conductor bounds in the form
            this.$scope.boundsModel = this.conductor.bounds();

            //If conductor has a time system selected already, populate the
            //form from it
            this.$scope.timeSystemModel = {};
            if (this.conductor.timeSystem()) {
                this.setFormFromTimeSystem(this.conductor.timeSystem());
            }

            //Represents the various modes, and the currently selected mode
            //in the view
            this.$scope.modeModel = {
                options: this.conductorViewService.availableModes()
            };

            var mode = this.conductorViewService.mode();
            if (mode) {
                //If view already defines a mode (eg. controller is being
                // initialized after navigation), then pre-populate form.
                this.setFormFromMode(mode);
                var deltas = this.conductorViewService.deltas();
                if (deltas) {
                    this.setFormFromDeltas(deltas);
                }

            }

            this.setFormFromBounds(this.conductor.bounds());

            // Watch scope for selection of mode or time system by user
            this.$scope.$watch('modeModel.selectedKey', this.setMode);
            this.$scope.$watch('timeSystem', this.changeTimeSystem);
        };

        /**
         * Called when the bounds change in the time conductor. Synchronizes
         * the bounds values in the time conductor with those in the form
         * @param bounds
         */
        TimeConductorController.prototype.setFormFromBounds = function (bounds) {
            this.$scope.boundsModel.start = bounds.start;
            this.$scope.boundsModel.end = bounds.end;
            if (!this.pendingUpdate) {
                this.pendingUpdate = true;
                requestAnimationFrame(function () {
                    this.pendingUpdate = false;
                    this.$scope.$digest();
                }.bind(this));
            }
        };

        TimeConductorController.prototype.setFormFromMode = function (mode) {
            this.$scope.modeModel.selectedKey = mode;
            //Synchronize scope with time system on mode
            this.$scope.timeSystemModel.options = this.conductorViewService.availableTimeSystems()
                .map(function (t) {
                    return t.metadata;
            });
        };

        /**
         * @private
         */
        TimeConductorController.prototype.setFormFromDeltas = function (deltas) {
            /*
             * If the selected mode defines deltas, set them in the form
             */
            if (deltas !== undefined) {
                this.$scope.boundsModel.startDelta = deltas.start;
                this.$scope.boundsModel.endDelta = deltas.end;
            } else {
                this.$scope.boundsModel.startDelta = 0;
                this.$scope.boundsModel.endDelta = 0;
            }
        };

        TimeConductorController.prototype.setFormFromTimeSystem = function (timeSystem) {
            this.$scope.timeSystemModel.selected = timeSystem;
            this.$scope.timeSystemModel.format = timeSystem.formats()[0];
            this.$scope.timeSystemModel.deltaFormat = timeSystem.deltaFormat();
        };


        /**
         * Called when form values are changed. Synchronizes the form with
         * the time conductor
         * @param formModel
         */
        TimeConductorController.prototype.updateBoundsFromForm = function (boundsModel) {
            this.conductor.bounds({
                start: boundsModel.start,
                end: boundsModel.end
            });
        };

        /**
         * Called when the delta values in the form change. Validates and
         * sets the new deltas on the Mode.
         * @param boundsModel
         * @see TimeConductorMode
         */
        TimeConductorController.prototype.updateDeltasFromForm = function (boundsModel) {
            var deltas = this.conductorViewService.deltas();

            if (deltas !== undefined && this.validation.validateDeltas(boundsModel.startDelta, boundsModel.endDelta)) {
                //Sychronize deltas between form and mode
                this.conductorViewService.deltas({start: parseFloat(boundsModel.startDelta), end: parseFloat(boundsModel.endDelta)});
            }
        };

        /**
         * Change the selected Time Conductor mode. This will call destroy
         * and initialization functions on the relevant modes, setting
         * default values for bound and deltas in the form.
         * @param newModeKey
         * @param oldModeKey
         */
        TimeConductorController.prototype.setMode = function (newModeKey, oldModeKey) {
            if (newModeKey !== oldModeKey) {
                this.conductorViewService.mode(newModeKey);
                this.setFormFromMode(newModeKey);
            }
        };

        /**
         * Allows time system to be changed by key. This supports selection
         * from the menu. Resolves a TimeSystem object and then invokes
         * TimeConductorController#setTimeSystem
         * @param key
         * @see TimeConductorController#setTimeSystem
         */
        TimeConductorController.prototype.selectTimeSystemByKey = function(key){
            var selected = this.timeSystems.find(function (timeSystem){
                return timeSystem.metadata.key === key;
            });
            this.conductor.timeSystem(selected, selected.defaults().bounds);
        };
        
        /**
         * Sets the selected time system. Will populate form with the default
         * bounds and deltas defined in the selected time system.
         * @param newTimeSystem
         */
        TimeConductorController.prototype.changeTimeSystem = function (newTimeSystem) {
            if (newTimeSystem && (newTimeSystem !== this.$scope.timeSystemModel.selected)) {
                this.setFormFromDeltas((newTimeSystem.defaults() || {}).deltas);
                this.setFormFromTimeSystem(newTimeSystem);
            }
        };

        return TimeConductorController;
    }
);